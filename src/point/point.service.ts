import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType, UserPoint, PointHistory } from './point.model';

@Injectable()
export class PointService {
  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) {}

  async getPoint(userId: number): Promise<UserPoint> {
    return await this.userPointTable.findByUserId(userId);
  }

  async getPointHistory(userId: number): Promise<PointHistory[]> {
    return await this.pointHistoryTable.findByUserId(userId);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new Error('Charge amount must be positive');
    }

    const updatedPoint = await this.userPointTable.incrementPoint(userId, amount);
    
    await this.pointHistoryTable.createHistory({
      userId,
      type: TransactionType.CHARGE,
      amount,
      timeMillis: Date.now(),
    });

    return updatedPoint;
  }

  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new Error('Use amount must be positive');
    }

    const currentPoint = await this.userPointTable.findByUserId(userId);
    
    if (currentPoint.point < amount) {
      throw new Error('Not enough point');
    }

    const updatedPoint = await this.userPointTable.decrementPoint(userId, amount);
    
    await this.pointHistoryTable.createHistory({
      userId,
      type: TransactionType.USE,
      amount,
      timeMillis: Date.now(),
    });

    return updatedPoint;
  }
}