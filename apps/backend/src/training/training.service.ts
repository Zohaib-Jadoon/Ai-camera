import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface TrainingOptions {
  sop_name: string;
  sop_title?: string;
  sop_description?: string;
  alert_title?: string;
  alert_message?: string;
  alert_severity?: string;
  target_class?: string;
  generalize_weapon?: boolean | string;
  base_model?: string;
  epochs?: number | string;
  batch_size?: number | string;
}

export interface TrainingProgress {
  sop_name: string;
  status: 'QUEUED' | 'EXTRACTING' | 'PREPARING' | 'TRAINING' | 'COMPLETED' | 'FAILED';
  epoch: number;
  total_epochs: number;
  progress_pct: number;
  box_loss: number;
  cls_loss: number;
  map50: number;
  message: string;
  error?: string | null;
  logs?: string[];
  updated_at?: number;
}

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private readonly aiEngineDir = path.resolve(__dirname, '../../../ai-engine');
  private readonly uploadDir = path.join(this.aiEngineDir, 'training_data', 'uploads');
  private readonly modelsDir = path.join(this.aiEngineDir, 'models');
  private activeJobs: Map<string, { pid?: number; startedAt: number }> = new Map();

  constructor(private readonly eventsGateway: EventsGateway) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  /**
   * Save uploaded ZIP file and initiate training background task.
   */
  async startTraining(file: any, options: TrainingOptions): Promise<TrainingProgress> {
    if (!file) {
      throw new BadRequestException('No dataset ZIP file uploaded');
    }

    const sopName = (options.sop_name || 'custom_sop')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    const epochs = Math.max(1, parseInt(String(options.epochs || 30), 10));
    const batchSize = Math.max(1, parseInt(String(options.batch_size || 16), 10));
    const baseModel = options.base_model || 'yolov8n.pt';
    const generalize = String(options.generalize_weapon).toLowerCase() !== 'false';

    // Save ZIP to disk
    const zipFilename = `${sopName}-${Date.now()}.zip`;
    const zipPath = path.join(this.uploadDir, zipFilename);

    if (file.buffer) {
      await fs.promises.writeFile(zipPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, zipPath);
      await fs.promises.unlink(file.path).catch(() => {});
    } else {
      throw new BadRequestException('Invalid file format received');
    }

    this.logger.log(`Dataset saved to ${zipPath}. Launching YOLO training for SOP: ${sopName}`);

    // Resolve python executable in ai-engine virtualenv
    const isWindows = process.platform === 'win32';
    const venvPython = isWindows
      ? path.join(this.aiEngineDir, '.venv', 'Scripts', 'python.exe')
      : path.join(this.aiEngineDir, '.venv', 'bin', 'python');

    const pythonBin = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3');

    const args = [
      '-m', 'src.dataset_trainer',
      '--zip', zipPath,
      '--sop', sopName,
      '--epochs', String(epochs),
      '--batch', String(batchSize),
      '--model', baseModel,
    ];

    if (options.sop_title) {
      args.push('--title', options.sop_title);
    }
    if (options.sop_description) {
      args.push('--description', options.sop_description);
    }
    if (options.alert_title) {
      args.push('--alert-title', options.alert_title);
    }
    if (options.alert_message) {
      args.push('--alert-message', options.alert_message);
    }
    if (options.alert_severity) {
      args.push('--alert-severity', options.alert_severity);
    }
    if (options.target_class) {
      args.push('--target-class', options.target_class);
    }
    if (generalize) {
      args.push('--generalize-weapon');
    }

    const child = spawn(pythonBin, args, {
      cwd: this.aiEngineDir,
      stdio: 'pipe',
      detached: false,
    });

    this.activeJobs.set(sopName, { pid: child.pid, startedAt: Date.now() });

    // Stream logs to training.log in the SOP folder
    const sopFolder = path.join(this.aiEngineDir, 'training_data', sopName);
    if (!fs.existsSync(sopFolder)) {
      fs.mkdirSync(sopFolder, { recursive: true });
    }
    const logPath = path.join(sopFolder, 'training.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('error', (err) => {
      this.logger.error(`Failed to launch training subprocess for ${sopName}: ${err.message}`);
      this.writeProgressFile(sopName, {
        sop_name: sopName,
        status: 'FAILED',
        epoch: 0,
        total_epochs: epochs,
        progress_pct: 0,
        box_loss: 0,
        cls_loss: 0,
        map50: 0,
        message: `Failed to launch training: ${err.message}`,
        error: err.message,
      });
      this.activeJobs.delete(sopName);
    });

    child.on('close', (code) => {
      this.logger.log(`Training subprocess for ${sopName} exited with code ${code}`);
      this.activeJobs.delete(sopName);
      if (code === 0) {
        // Notify AI Engine that a new model was trained
        this.eventsGateway.emitToAiEngines('request_registry', {});
      }
    });

    return {
      sop_name: sopName,
      status: 'QUEUED',
      epoch: 0,
      total_epochs: epochs,
      progress_pct: 0,
      box_loss: 0,
      cls_loss: 0,
      map50: 0,
      message: 'Training job launched in background.',
    };
  }

  /**
   * Get real-time progress, metrics, and logs for an SOP training job.
   */
  async getStatus(sopName: string): Promise<TrainingProgress> {
    const cleanSop = sopName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const sopFolder = path.join(this.aiEngineDir, 'training_data', cleanSop);
    const progressFile = path.join(sopFolder, 'progress.json');
    const logFile = path.join(sopFolder, 'training.log');

    let progress: TrainingProgress = {
      sop_name: cleanSop,
      status: 'QUEUED',
      epoch: 0,
      total_epochs: 30,
      progress_pct: 0,
      box_loss: 0,
      cls_loss: 0,
      map50: 0,
      message: 'Waiting for training to start...',
    };

    if (fs.existsSync(progressFile)) {
      try {
        const raw = await fs.promises.readFile(progressFile, 'utf-8');
        progress = { ...progress, ...JSON.parse(raw) };
      } catch (e) {
        this.logger.warn(`Could not parse progress.json for ${cleanSop}`);
      }
    }

    // Attach latest log tail
    if (fs.existsSync(logFile)) {
      try {
        const logContent = await fs.promises.readFile(logFile, 'utf-8');
        const lines = logContent.split(/\r?\n/).filter(Boolean);
        progress.logs = lines.slice(-60); // last 60 lines
      } catch (e) {
        progress.logs = [];
      }
    }

    return progress;
  }

  /**
   * List all registered and available trained models.
   */
  async listModels(): Promise<any[]> {
    const registryPath = path.join(this.modelsDir, 'registry.json');
    let registryData: Record<string, any> = {};

    if (fs.existsSync(registryPath)) {
      try {
        const raw = await fs.promises.readFile(registryPath, 'utf-8');
        registryData = JSON.parse(raw);
      } catch (e) {
        this.logger.warn(`Failed to read registry.json: ${e}`);
      }
    }

    // Also scan for any existing .pt files
    const ptFiles = fs.existsSync(this.modelsDir)
      ? (await fs.promises.readdir(this.modelsDir)).filter((f) => f.endsWith('.pt'))
      : [];

    const modelsList = Object.values(registryData);

    for (const pt of ptFiles) {
      const sop = pt.replace(/\.pt$/, '');
      const existing = modelsList.find((m: any) => m.sop_name === sop);
      if (!existing) {
        const stat = await fs.promises.stat(path.join(this.modelsDir, pt));
        modelsList.push({
          sop_name: sop,
          model_path: path.join(this.modelsDir, pt),
          map50: null,
          epochs: null,
          size_mb: Math.round((stat.size / (1024 * 1024)) * 10) / 10,
          registered_at: stat.mtime.toISOString(),
          notes: 'Pre-existing model weights',
        });
      }
    }

    return modelsList;
  }

  /**
   * Hot-swap camera AI detector to use the specified SOP's model.
   */
  async deployModel(sopName: string): Promise<{ ok: boolean; message: string }> {
    const cleanSop = sopName.trim().toLowerCase();
    this.logger.log(`Triggering hot-deploy for model SOP: ${cleanSop}`);

    if (!this.eventsGateway.isAiEngineConnected()) {
      throw new BadRequestException('AI Engine is currently offline or not connected via socket.');
    }

    this.eventsGateway.emitToAiEngines('request_model_swap', { sop_name: cleanSop });
    return { ok: true, message: `Hot-swap request sent to AI Engine for SOP: ${cleanSop}` };
  }

  private writeProgressFile(sopName: string, data: TrainingProgress) {
    const sopFolder = path.join(this.aiEngineDir, 'training_data', sopName);
    if (!fs.existsSync(sopFolder)) fs.mkdirSync(sopFolder, { recursive: true });
    fs.writeFileSync(path.join(sopFolder, 'progress.json'), JSON.stringify(data, null, 2));
  }
}
