// apps/api/src/modules/users/entities/user.entity.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['MANAGER', 'KITCHEN', 'POS'] })
  role: string;
}
