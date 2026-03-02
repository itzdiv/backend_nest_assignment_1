// Supabase Storage Service — wraps the Supabase JS client for file operations.

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private supabase: SupabaseClient;
  private bucketName: string;

  onModuleInit() {
    this.bucketName = process.env.SUPABASE_BUCKET_RESUME!;
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  get bucket(): string {
    return this.bucketName;
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, buffer, { contentType, upsert: false });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return path;
  }

  async deleteFile(paths: string[]): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove(paths);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresIn = 900): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed URL failed: ${error?.message}`);
    }

    return data.signedUrl;
  }
}
