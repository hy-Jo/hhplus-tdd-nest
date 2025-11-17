import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType } from './point.model';

describe('PointService', () => {
  let service: PointService;
  let userPointTable: jest.Mocked<UserPointTable>;
  let historyTable: jest.Mocked<PointHistoryTable>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: UserPointTable,
          useValue: {
            findByUserId: jest.fn(),
            incrementPoint: jest.fn(),
            decrementPoint: jest.fn(),
          },
        },
        {
          provide: PointHistoryTable,
          useValue: {
            createHistory: jest.fn(),
            findByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get(UserPointTable);
    historyTable = module.get(PointHistoryTable);
  });

  describe('getPoint', () => {
    it('should return user point', async () => {
      // Given
      const userId = 1;
      const expectedPoint = {
        id: userId,
        point: 1500,
        updateMillis: Date.now(),
      };
      userPointTable.findByUserId.mockResolvedValue(expectedPoint);

      // When
      const result = await service.getPoint(userId);

      // Then
      expect(result).toEqual(expectedPoint);
      expect(userPointTable.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return user point with zero balance for new user', async () => {
      // Given
      const userId = 999;
      const expectedPoint = {
        id: userId,
        point: 0,
        updateMillis: Date.now(),
      };
      userPointTable.findByUserId.mockResolvedValue(expectedPoint);

      // When
      const result = await service.getPoint(userId);

      // Then
      expect(result).toEqual(expectedPoint);
      expect(userPointTable.findByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('getPointHistory', () => {
    it('should return user point history', async () => {
      // Given
      const userId = 1;
      const expectedHistory = [
        { userId, type: TransactionType.CHARGE, amount: 1000, timeMillis: Date.now() },
        { userId, type: TransactionType.USE, amount: 500, timeMillis: Date.now() },
      ];
      historyTable.findByUserId.mockResolvedValue(expectedHistory);

      // When
      const result = await service.getPointHistory(userId);

      // Then
      expect(result).toEqual(expectedHistory);
      expect(historyTable.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return empty array for user with no history', async () => {
      // Given
      const userId = 999;
      historyTable.findByUserId.mockResolvedValue([]);

      // When
      const result = await service.getPointHistory(userId);

      // Then
      expect(result).toEqual([]);
      expect(historyTable.findByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('chargePoint', () => {
    it('should charge points and create history', async () => {
      // Given
      const userId = 1;
      const amount = 1000;

      userPointTable.incrementPoint.mockResolvedValue({
        id: userId,
        point: amount,
        updateMillis: Date.now(),
      });

      // When
      const result = await service.chargePoint(userId, amount);

      // Then
      expect(result.point).toBe(amount);
      expect(historyTable.createHistory).toHaveBeenCalled();
    });

    it('should throw error when amount is negative', async () => {
      // When & Then
      await expect(service.chargePoint(1, -1000)).rejects.toThrow('Charge amount must be positive');
    });

    it('should throw error when amount is zero', async () => {
      // When & Then
      await expect(service.chargePoint(1, 0)).rejects.toThrow('Charge amount must be positive');
    });

    it('should handle large amounts correctly', async () => {
      // Given
      const userId = 1;
      const amount = 1000000;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      userPointTable.incrementPoint.mockResolvedValue({
        id: userId,
        point: amount,
        updateMillis: now,
      });

      // When
      const result = await service.chargePoint(userId, amount);

      // Then
      expect(result.point).toBe(amount);
      expect(userPointTable.incrementPoint).toHaveBeenCalledWith(userId, amount);
    });
  });

  describe('usePoint', () => {
    it('should use points and create history when sufficient balance', async () => {
      // Given
      const userId = 1;
      const amount = 500;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      userPointTable.findByUserId.mockResolvedValue({
        id: userId,
        point: 1000,
        updateMillis: now,
      });

      userPointTable.decrementPoint.mockResolvedValue({
        id: userId,
        point: 500,
        updateMillis: now,
      });

      // When
      const result = await service.usePoint(userId, amount);

      // Then
      expect(result.point).toBe(500);
      expect(userPointTable.decrementPoint).toHaveBeenCalledWith(userId, amount);
      expect(historyTable.createHistory).toHaveBeenCalledWith({
        userId,
        type: TransactionType.USE,
        amount,
        timeMillis: now,
      });
    });

    it('should throw error when not enough point', async () => {
      // Given
      userPointTable.findByUserId.mockResolvedValue({
        id: 1,
        point: 500,
        updateMillis: Date.now(),
      });

      // When & Then
      await expect(service.usePoint(1, 1000)).rejects.toThrow('Not enough point');
    });

    it('should throw error when amount is negative', async () => {
      // When & Then
      await expect(service.usePoint(1, -500)).rejects.toThrow(
        'Use amount must be positive',
      );
    });

    it('should throw error when amount is zero', async () => {
      // When & Then
      await expect(service.usePoint(1, 0)).rejects.toThrow(
        'Use amount must be positive',
      );
    });

    it('should allow using exact amount of available points', async () => {
      // Given
      const userId = 1;
      const amount = 1000;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      userPointTable.findByUserId.mockResolvedValue({
        id: userId,
        point: 1000,
        updateMillis: now,
      });

      userPointTable.decrementPoint.mockResolvedValue({
        id: userId,
        point: 0,
        updateMillis: now,
      });

      // When
      const result = await service.usePoint(userId, amount);

      // Then
      expect(result.point).toBe(0);
      expect(userPointTable.decrementPoint).toHaveBeenCalledWith(userId, amount);
    });

    it('should throw error when trying to use points with zero balance', async () => {
      // Given
      userPointTable.findByUserId.mockResolvedValue({
        id: 1,
        point: 0,
        updateMillis: Date.now(),
      });

      // When & Then
      await expect(service.usePoint(1, 100)).rejects.toThrow('Not enough point');
    });
  });
});