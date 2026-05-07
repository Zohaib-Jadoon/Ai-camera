import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from './camera.entity';

@Injectable()
export class CameraService {
  constructor(
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
  ) {}

  findAll(): Promise<Camera[]> {
    return this.cameraRepository.find();
  }

  findOne(id: string): Promise<Camera | null> {
    return this.cameraRepository.findOneBy({ id });
  }

  async create(camera: Partial<Camera>): Promise<Camera> {
    const newCamera = this.cameraRepository.create(camera);
    return this.cameraRepository.save(newCamera);
  }

  async update(id: string, camera: Partial<Camera>): Promise<Camera | null> {
    await this.cameraRepository.update(id, camera);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.cameraRepository.delete(id);
  }
}
