import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType } from './point.model';

describe('PointService', () => {
  let service: PointService;
  let userPointTable: any;
  let historyTable: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: UserPointTable,
          useValue: {
            selectById: jest.fn(),
            insertOrUpdate: jest.fn(),
          },
        },
        {
          provide: PointHistoryTable,
          useValue: {
            insert: jest.fn(),
            selectAllByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get(UserPointTable);
    historyTable = module.get(PointHistoryTable);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPoint', () => {
    it('should return user point', async () => {
      const userId = 1;
      const expectedPoint = { id: userId, point: 100, updateMillis: Date.now() };
      userPointTable.selectById.mockResolvedValue(expectedPoint);

      const result = await service.getPoint(userId);

      expect(result).toEqual(expectedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
    });
  });

  describe('getPointHistory', () => {
    it('should return point history', async () => {
      const userId = 1;
      const expectedHistory = [
        { userId, amount: 50, type: TransactionType.CHARGE, timeMillis: Date.now() },
      ];
      historyTable.selectAllByUserId.mockResolvedValue(expectedHistory);

      const result = await service.getPointHistory(userId);

      expect(result).toEqual(expectedHistory);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('chargePoint', () => {
    it('should charge user point', async () => {
      const userId = 1;
      const chargeAmount = 50;
      const currentPoint = { id: userId, point: 100, updateMillis: Date.now() };
      const updatedPoint = { id: userId, point: 150, updateMillis: Date.now() };
      
      userPointTable.selectById.mockResolvedValue(currentPoint);
      userPointTable.insertOrUpdate.mockResolvedValue(updatedPoint);

      const result = await service.chargePoint(userId, chargeAmount);

      expect(result).toEqual(updatedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(
        userId,
        currentPoint.point + chargeAmount
      );
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        chargeAmount,
        TransactionType.CHARGE,
        expect.any(Number)
      );
    });

    it('should throw an error if charge amount is non-positive', async () => {
      await expect(service.chargePoint(1, 0)).rejects.toThrow(
        'Charge amount must be positive'
      );
    });
  });

  describe('usePoint', () => {
    it('should use user point', async () => {
      const userId = 1;
      const useAmount = 50;
      const currentPoint = { id: userId, point: 100, updateMillis: Date.now() };
      const updatedPoint = { id: userId, point: 50, updateMillis: Date.now() };
      
      userPointTable.selectById.mockResolvedValue(currentPoint);
      userPointTable.insertOrUpdate.mockResolvedValue(updatedPoint);

      const result = await service.usePoint(userId, useAmount);

      expect(result).toEqual(updatedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(
        userId,
        currentPoint.point - useAmount
      );
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        useAmount,
        TransactionType.USE,
        expect.any(Number)
      );
    });

    it('should throw an error if use amount is non-positive', async () => {
      await expect(service.usePoint(1, 0)).rejects.toThrow(
        'Use amount must be positive'
      );
    });

    it('should throw an error if not enough point', async () => {
      const userId = 1;
      const useAmount = 200;
      const currentPoint = { id: userId, point: 100, updateMillis: Date.now() };
      
      userPointTable.selectById.mockResolvedValue(currentPoint);

      await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
        'Not enough point'
      );
    });
  });
});