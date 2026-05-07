import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AiEventsService } from '../ai-events/ai-events.service';
import type { Detection } from '@madad/types';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  constructor(private aiEventsService: AiEventsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('detection')
  async handleDetection(client: Socket, payload: Detection): Promise<void> {
    this.logger.log(`Received detection: ${JSON.stringify(payload)}`);

    // Persist detection
    await this.aiEventsService.createDetection({
      camera_id: payload.camera_id,
      object_type: payload.object_type,
      confidence: payload.confidence,
      timestamp: new Date(payload.timestamp),
      snapshot_url: payload.snapshot_url,
    });

    // Broadcast to all clients (e.g., the web dashboard)
    this.server.emit('alert', payload);
  }
}
