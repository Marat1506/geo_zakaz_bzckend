import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join_seller_room')
  handleJoinSellerRoom(
    @MessageBody() data: { sellerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`seller:${data.sellerId}`);
  }

  @SubscribeMessage('join_order_room')
  handleJoinOrderRoom(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`order:${data.orderId}`);
  }

  emitNewOrder(sellerId: string, order: any) {
    this.server.to(`seller:${sellerId}`).emit('new_order', order);
  }

  emitOrderStatusChanged(orderId: string, status: string) {
    this.server.to(`order:${orderId}`).emit('order_status_changed', { orderId, status });
  }
}
