import { Controller, Get, Post, Delete, Put, Param, Body, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('cleanup-self-follows')
  async cleanupSelfFollows() {
    return this.userService.cleanupSelfFollows();
  }

  @Get('list-all-simple')
  async listAllSimple() {
    return this.userService.listAllSimple();
  }

  @Get('debug/:username')
  async debugUser(@Param('username') username: string) {
    return this.userService.debugUser(username);
  }

  @Get('reset-follows/:username')
  async resetFollows(@Param('username') username: string) {
    return this.userService.resetUserFollows(username);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchUsers(@Query('q') query: string) {
    return this.userService.searchUsers(query || '');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('username/:username')
  async findByUsername(@Param('username') username: string) {
    return this.userService.findByUsername(username);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async followUser(@Request() req, @Param('id') targetUserId: string) {
    return this.userService.followUser(req.user.id, targetUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollowUser(@Request() req, @Param('id') targetUserId: string) {
    return this.userService.unfollowUser(req.user.id, targetUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/is-following')
  async isFollowing(@Request() req, @Param('id') targetUserId: string) {
    const isFollowing = await this.userService.isFollowing(req.user.id, targetUserId);
    return { isFollowing };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/profile')
  @UseInterceptors(
    FileInterceptor('profileImage', {
      storage: diskStorage({
        destination: './uploads/profiles',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `profile-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async updateProfile(
    @Param('id') userId: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    if (req.user.id !== userId) {
      throw new Error('No puedes editar el perfil de otro usuario');
    }
    
    const updateProfileDto: UpdateProfileDto = {
      username: body.username,
      fullName: body.fullName,
      email: body.email,
      bio: body.bio,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    };
    
    const profileImage = file ? `http://localhost:3000/uploads/profiles/${file.filename}` : undefined;
    return this.userService.updateProfile(userId, updateProfileDto, profileImage);
  }
}
