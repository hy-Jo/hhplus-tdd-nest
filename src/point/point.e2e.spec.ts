import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Point API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /point/:id', () => {
    it('should return user point', () => {
      return request(app.getHttpServer())
        .get('/point/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 1);
          expect(res.body).toHaveProperty('point');
          expect(res.body).toHaveProperty('updateMillis');
          expect(typeof res.body.point).toBe('number');
          expect(res.body.point).toBeGreaterThanOrEqual(0);
        });
    });

    it('should return 200 for new user with zero balance', () => {
      return request(app.getHttpServer())
        .get('/point/999')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 999);
          expect(res.body.point).toBe(0);
        });
    });
  });

  describe('GET /point/:id/histories', () => {
    it('should return user point histories', () => {
      return request(app.getHttpServer())
        .get('/point/2/histories')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return empty array for user with no history', () => {
      return request(app.getHttpServer())
        .get('/point/998/histories')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(0);
        });
    });
  });

  describe('PATCH /point/:id/charge', () => {
    it('should charge points successfully', () => {
      return request(app.getHttpServer())
        .patch('/point/10/charge')
        .send({ amount: 1000 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 10);
          expect(res.body).toHaveProperty('point');
          expect(res.body.point).toBeGreaterThanOrEqual(1000);
        });
    });

    it('should return 400 when amount is negative', () => {
      return request(app.getHttpServer())
        .patch('/point/11/charge')
        .send({ amount: -1000 })
        .expect(400);
    });

    it('should return 400 when amount is zero', () => {
      return request(app.getHttpServer())
        .patch('/point/12/charge')
        .send({ amount: 0 })
        .expect(400);
    });

    it('should return 400 when amount is missing', () => {
      return request(app.getHttpServer())
        .patch('/point/13/charge')
        .send({})
        .expect(400);
    });

    it('should return 400 when amount is not a number', () => {
      return request(app.getHttpServer())
        .patch('/point/14/charge')
        .send({ amount: 'invalid' })
        .expect(400);
    });
  });

  describe('PATCH /point/:id/use', () => {
    it('should use points when sufficient balance', async () => {
      // 먼저 충전
      await request(app.getHttpServer())
        .patch('/point/20/charge')
        .send({ amount: 2000 })
        .expect(200);

      // 사용
      return request(app.getHttpServer())
        .patch('/point/20/use')
        .send({ amount: 500 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 20);
          expect(res.body).toHaveProperty('point');
          expect(res.body.point).toBe(1500);
        });
    });

    it('should return 400 when not enough points', async () => {
      return request(app.getHttpServer())
        .patch('/point/21/use')
        .send({ amount: 10000 })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Not enough point');
        });
    });

    it('should return 400 when amount is negative', () => {
      return request(app.getHttpServer())
        .patch('/point/22/use')
        .send({ amount: -500 })
        .expect(400);
    });

    it('should return 400 when amount is zero', () => {
      return request(app.getHttpServer())
        .patch('/point/23/use')
        .send({ amount: 0 })
        .expect(400);
    });

    it('should allow using exact amount of available points', async () => {
      // 충전
      await request(app.getHttpServer())
        .patch('/point/24/charge')
        .send({ amount: 1000 })
        .expect(200);

      // 전체 포인트 사용
      return request(app.getHttpServer())
        .patch('/point/24/use')
        .send({ amount: 1000 })
        .expect(200)
        .expect((res) => {
          expect(res.body.point).toBe(0);
        });
    });
  });

  describe('Integration flow', () => {
    it('should handle complete charge-use-history flow', async () => {
      const userId = 100;

      // 1. 초기 포인트 조회
      const initialResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      
      const initialPoint = initialResponse.body.point;

      // 2. 포인트 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: 1000 })
        .expect(200)
        .expect((res) => {
          expect(res.body.point).toBe(initialPoint + 1000);
        });

      // 3. 포인트 사용
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: 300 })
        .expect(200)
        .expect((res) => {
          expect(res.body.point).toBe(initialPoint + 1000 - 300);
        });

      // 4. 최종 포인트 조회
      await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.point).toBe(initialPoint + 1000 - 300);
        });

      // 5. 히스토리 조회
      return request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          
          const chargeHistory = res.body.find((h: any) => h.type === 'CHARGE' && h.amount === 1000);
          const useHistory = res.body.find((h: any) => h.type === 'USE' && h.amount === 300);
          
          expect(chargeHistory).toBeDefined();
          expect(useHistory).toBeDefined();
          expect(chargeHistory.userId).toBe(userId);
          expect(useHistory.userId).toBe(userId);
        });
    });

    it('should maintain consistency across multiple operations', async () => {
      const userId = 200;

      // 여러 번 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: 500 })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: 300 })
        .expect(200);

      // 일부 사용
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: 200 })
        .expect(200);

      // 최종 포인트 확인 (500 + 300 - 200 = 600)
      const finalResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);

      expect(finalResponse.body.point).toBe(600);

      // 히스토리 개수 확인 (충전 2번 + 사용 1번 = 3개)
      return request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(3);
          
          const chargeHistories = res.body.filter((h: any) => h.type === 'CHARGE');
          const useHistories = res.body.filter((h: any) => h.type === 'USE');
          
          expect(chargeHistories.length).toBe(2);
          expect(useHistories.length).toBe(1);
        });
    });
  });
});