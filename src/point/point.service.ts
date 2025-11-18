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
    return await this.userPointTable.selectById(userId);
  }

  async getPointHistory(userId: number): Promise<PointHistory[]> {
    return await this.pointHistoryTable.selectAllByUserId(userId);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new Error('Charge amount must be positive');
    }

    const currentPoint = await this.userPointTable.selectById(userId);
    const updatedPoint = await this.userPointTable.insertOrUpdate(
      userId,
      currentPoint.point + amount
    );
    
    await this.pointHistoryTable.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      Date.now()
    );

    return updatedPoint;
  }

  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    if (amount <= 0) {
      throw new Error('Use amount must be positive');
    }

    const currentPoint = await this.userPointTable.selectById(userId);
    
    if (currentPoint.point < amount) {
      throw new Error('Not enough point');
    }

    const updatedPoint = await this.userPointTable.insertOrUpdate(
      userId,
      currentPoint.point - amount
    );
    
    await this.pointHistoryTable.insert(
      userId,
      amount,
      TransactionType.USE,
      Date.now()
    );

    return updatedPoint;
  }
}