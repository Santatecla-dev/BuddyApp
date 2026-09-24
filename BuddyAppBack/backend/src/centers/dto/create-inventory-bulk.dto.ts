import { IsInt, Max, Min } from 'class-validator';
import { CreateInventoryItemDto } from './create-inventory-item.dto';

export class CreateInventoryBulkDto extends CreateInventoryItemDto {
  @IsInt()
  @Min(2)
  @Max(100)
  count: number;
}
