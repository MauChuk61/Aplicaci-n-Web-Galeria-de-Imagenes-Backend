import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['followers', 'following'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const { password: _, followers, following, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      followers: followers?.length || 0,
      following: following?.length || 0,
      followingIds: following?.map(u => u.id) || [],
    };
  }

  async findByUsername(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['followers', 'following'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const { password: _, followers, following, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      followers: followers?.length || 0,
      following: following?.length || 0,
      followingIds: following?.map(u => u.id) || [],
    };
  }

  async findAll() {
    const users = await this.userRepository.find({
      relations: ['followers', 'following'],
    });
    return users.map(user => {
      const { password: _, followers, following, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        followers: followers?.length || 0,
        following: following?.length || 0,
      };
    });
  }

  async searchUsers(query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const users = await this.userRepository.find({
      where: [
        { username: Like(`%${query}%`) },
      ],
      relations: ['followers', 'following'],
      take: 20,
    });
    
    return users.map(user => {
      const { password: _, followers, following, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        followers: followers?.length || 0,
        following: following?.length || 0,
      };
    });
  }

  async followUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['following'],
    });
    
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['followers'],
    });

    if (!user || !targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si ya lo sigue
    const alreadyFollowing = user.following?.some(u => u.id === targetUserId);
    
    if (alreadyFollowing) {
      throw new BadRequestException('Ya sigues a este usuario');
    }

    // Agregar la relación
    if (!user.following) {
      user.following = [];
    }
    user.following.push(targetUser);
    await this.userRepository.save(user);

    // Crear notificación
    await this.notificationsService.createNotification(
      targetUserId,
      userId,
      'follow',
      null,
      'empezó a seguirte',
    );

    return { message: 'Usuario seguido exitosamente' };
  }

  async unfollowUser(userId: string, targetUserId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['following'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Remover la relación
    user.following = user.following?.filter(u => u.id !== targetUserId) || [];
    await this.userRepository.save(user);

    return { message: 'Usuario dejado de seguir exitosamente' };
  }

  async isFollowing(userId: string, targetUserId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['following'],
    });

    if (!user) {
      return false;
    }

    return user.following?.some(u => u.id === targetUserId) || false;
  }

  async listAllSimple() {
    const users = await this.userRepository.find({
      select: ['id', 'username', 'email', 'fullName'],
      relations: ['followers', 'following'],
    });
    
    return users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
    }));
  }

  async debugUser(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['followers', 'following'],
    });
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    
    return {
      username: user.username,
      id: user.id,
      followers: user.followers?.map(f => ({ id: f.id, username: f.username })) || [],
      following: user.following?.map(f => ({ id: f.id, username: f.username })) || [],
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
    };
  }

  async resetUserFollows(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['followers', 'following'],
    });
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    
    user.following = [];
    await this.userRepository.save(user);
    
    return { message: `Follows reseteados para ${username}` };
  }

  async cleanupSelfFollows() {
    const users = await this.userRepository.find({
      relations: ['following'],
    });

    let cleaned = 0;
    for (const user of users) {
      if (user.following?.some(u => u.id === user.id)) {
        user.following = user.following.filter(u => u.id !== user.id);
        await this.userRepository.save(user);
        cleaned++;
      }
    }

    return { message: `Limpiados ${cleaned} auto-follows` };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto, profileImage?: string) {
    console.log('[UpdateProfile] UserId:', userId);
    console.log('[UpdateProfile] DTO:', updateProfileDto);
    console.log('[UpdateProfile] ProfileImage:', profileImage);
    
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Realizar verificaciones de duplicados en paralelo para mejor rendimiento
    const checks = [];
    
    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      checks.push(
        this.userRepository.findOne({ where: { username: updateProfileDto.username } })
          .then(existingUser => {
            if (existingUser) {
              throw new BadRequestException('El nombre de usuario ya está en uso');
            }
          })
      );
    }
    
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      checks.push(
        this.userRepository.findOne({ where: { email: updateProfileDto.email } })
          .then(existingEmail => {
            if (existingEmail) {
              throw new BadRequestException('El correo electrónico ya está en uso');
            }
          })
      );
    }
    
    // Esperar todas las verificaciones en paralelo
    if (checks.length > 0) {
      await Promise.all(checks);
    }
    
    // Actualizar los campos si pasaron las validaciones
    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      user.username = updateProfileDto.username;
    }
    
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      user.email = updateProfileDto.email;
    }

    // Cambiar contraseña si se proporcionó
    if (updateProfileDto.newPassword) {
      if (!updateProfileDto.currentPassword) {
        throw new BadRequestException('Debes proporcionar tu contraseña actual');
      }
      
      const isPasswordValid = await bcrypt.compare(
        updateProfileDto.currentPassword,
        user.password
      );
      
      if (!isPasswordValid) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }
      
      user.password = await bcrypt.hash(updateProfileDto.newPassword, 10);
    }

    // Actualizar otros campos
    if (updateProfileDto.fullName !== undefined) {
      user.fullName = updateProfileDto.fullName;
    }
    if (updateProfileDto.bio !== undefined) {
      user.bio = updateProfileDto.bio;
    }
    if (profileImage) {
      user.profileImage = profileImage;
    }

    const savedUser = await this.userRepository.save(user);
    console.log('[UpdateProfile] Usuario guardado:', savedUser.username);

    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }
}
