import { ApiProperty } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty({ description: 'Identificador del usuario en Firebase' })
  uid!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;
}
