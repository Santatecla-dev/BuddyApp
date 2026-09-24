import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DiveCenter } from '../centers/dive-center.entity';
import { RegisterCenterDto } from '../centers/dto/register-center.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(DiveCenter)
    private centersRepo: Repository<DiveCenter>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      passwordHash,
      accountType: 'diver',
    });

    return this.usersRepo.save(user);
  }

  async registerCenter(dto: RegisterCenterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersRepo.save(this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      accountType: 'center',
    }));
    const baseSlug = dto.centerName.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `center-${user.id}`;
    const center = await this.centersRepo.save(this.centersRepo.create({
      ownerUserId: user.id,
      name: dto.centerName.trim(),
      slug: `${baseSlug}-${user.id}`,
      description: dto.description?.trim() || null,
      city: dto.city?.trim() || null,
      country: dto.country?.trim() || null,
      email: dto.email,
      contactName: dto.name.trim(),
      phone: dto.phone?.trim() || null,
      website: dto.website?.trim() || null,
      verified: false,
    }));
    return { id: user.id, name: user.name, email: user.email, accountType: user.accountType, centerId: center.id };
  }
  // login
  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const center = user.accountType === 'center' ? await this.centersRepo.findOne({ where: { ownerUserId: user.id } }) : null;
    const token = this.jwtService.sign({ userId: user.id, email: user.email, accountType: user.accountType, centerId: center?.id });

    return { accessToken: token, accountType: user.accountType, centerId: center?.id ?? null };
  }
}
