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
    const detection = await this.eventsService.createDetection(payload);
    this.server.emit('detection_update', detection);
  }

  @SubscribeMessage('face_event')
  async handleFaceEvent(client: Socket, payload: any) {
    this.logger.log(`Received face event: ${JSON.stringify(payload)}`);
    // Logic to save face event could go here
    this.server.emit('face_update', payload);
  }

  @SubscribeMessage('alert')
  async handleAlert(client: Socket, payload: any) {
    this.logger.log(`Received alert: ${JSON.stringify(payload)}`);
    const alert = await this.alertsService.createAlert(payload);
    this.server.emit('alert', alert);
  }
}
