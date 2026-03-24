import 'reflect-metadata';
import { applyDecorators } from './apply-decorators';
import { IsOptional } from 'class-validator';

export function PartialType<T extends new (...args: any[]) => {}>(BaseClass: T) {
  class PartialClass extends (BaseClass as any) {
    constructor(...args: any[]) {
      super(...args);
    }
  }

  // Get all property keys from BaseClass prototype
  const keys = Reflect.ownKeys(BaseClass.prototype);

  keys.forEach((key) => {
    if (key === 'constructor') return;

    // Apply IsOptional to each property
    applyDecorators(PartialClass.prototype, key, [IsOptional()]);
  });

  return PartialClass;
}