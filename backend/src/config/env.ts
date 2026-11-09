import 'reflect-metadata';
import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// Implicit conversion would turn the string "false" into true.
function parseBoolean(value: unknown): unknown {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === '') return false;
  return value;
}

export class Env {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16)
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN: string = '8h';

  @IsString()
  DATA_DIR: string = '../data';

  @IsString()
  @IsNotEmpty()
  INGEST_FILE: string = 'telemetrias.jsonl';

  @IsInt()
  @Min(1)
  @Max(10_000)
  INGEST_BATCH_SIZE: number = 500;

  /** Replay speed; 0 disables throttling. */
  @IsInt()
  @Min(0)
  INGEST_PACKETS_PER_SECOND: number = 2_000;

  @Transform(({ obj, key }) => parseBoolean(obj[key]))
  @IsBoolean()
  INGEST_FROM_START: boolean = false;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return env;
}
