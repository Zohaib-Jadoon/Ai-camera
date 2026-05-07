import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventsService } from './events.service';
import { AlertsService } from './alerts.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  constructor(
    private eventsService: EventsService,
    private alertsService: AlertsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('detection')
  async handleDetection(client: Socket, payload: any) {
    this.logger.log(`Received detection: ${JSON.stringify(payload)}`);

    // Save to DB
    const detection = await this.eventsService.createDetection(payload);

    // Check for rules/alerts (simplified logic)
    if (payload.object_type === 'human' && payload.confidence > 0.8) {
        const alert = await this.alertsService.createAlert({
            event_id: detection.id,
            alert_type: 'INTRUSION',
            camera_id: detection.cameraId,
            confidence: detection.confidence,
            snapshot_url: detection.snapshotUrl,
        });
        this.server.emit('alert', alert);
    }

    // Broadcast detection to all clients (for live overlays)
    this.server.emit('detection_update', detection);
  }
}
