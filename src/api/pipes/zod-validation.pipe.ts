import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {

  /*
    schema is generic so it can validate any shape
  */
  constructor(private readonly schema: ZodType<any>) {}

  transform(value: unknown) {
    /*
      We let Zod decide the type.
    */
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return result.data;
  }
}
