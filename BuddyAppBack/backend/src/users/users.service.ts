/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DiveBuddy } from '../dives/dive-buddy.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,

    @InjectRepository(DiveBuddy)
    private diveBuddyRepo: Repository<DiveBuddy>, // 🔹 nuevo
  ) {}

  async getProfile(userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name', 'agency', 'certifications', 'createdAt'],
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const totalDives = await this.getTotalDives(userId);

    return { ...user, totalDives };
  }
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.agency !== undefined) {
      user.agency = dto.agency;
    }

    if (dto.certifications !== undefined) {
      user.certifications = dto.certifications;
    }

    await this.usersRepo.save(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      agency: user.agency,
      certifications: user.certifications,
    };
  }
  async getPublicProfile(userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'agency', 'certifications'],
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const totalDives = await this.getTotalDives(userId);

    return { ...user, totalDives };
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getTotalDives(userId: number): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return this.diveBuddyRepo.count({ where: { userId } });
  }
  async getSharedDivesWithUser(
    viewedUserId: number,
    myUserId: number,
  ): Promise<number> {
    return this.diveBuddyRepo.count({
      where: {
        userId: viewedUserId,
        dive: {
          buddies: { userId: myUserId }, // contar dives donde tú estás
        },
      },
      relations: ['dive', 'dive.buddies'],
    });
  }
}
