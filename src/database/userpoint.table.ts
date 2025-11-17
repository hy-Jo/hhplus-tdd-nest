import { Injectable } from "@nestjs/common";
import { UserPoint } from "../point/point.model";

/**
 * 해당 Table 클래스는 변경하지 않고 공개된 API 만을 사용해 데이터를 제어합니다.
 */
@Injectable()
export class UserPointTable {
    private readonly table: Record<number, UserPoint> = {};

    async findByUserId(userId: number): Promise<UserPoint> {
        const userPoint = this.table[userId];
        if (userPoint) {
            return userPoint;
        }
        
        // 새 유저인 경우 0 포인트로 초기화
        const newUserPoint: UserPoint = {
            id: userId,
            point: 0,
            updateMillis: Date.now(),
        };
        this.table[userId] = newUserPoint;
        return newUserPoint;
    }

    async incrementPoint(userId: number, amount: number): Promise<UserPoint> {
        const currentPoint = await this.findByUserId(userId);
        const updatedPoint: UserPoint = {
            id: userId,
            point: currentPoint.point + amount,
            updateMillis: Date.now(),
        };
        this.table[userId] = updatedPoint;
        return updatedPoint;
    }

    async decrementPoint(userId: number, amount: number): Promise<UserPoint> {
        const currentPoint = await this.findByUserId(userId);
        const updatedPoint: UserPoint = {
            id: userId,
            point: currentPoint.point - amount,
            updateMillis: Date.now(),
        };
        this.table[userId] = updatedPoint;
        return updatedPoint;
    }
}