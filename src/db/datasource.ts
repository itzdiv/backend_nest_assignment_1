import 'dotenv/config';
//will be used at runtime by nest and by orm for cli migrations
import { DataSource } from 'typeorm';



export const AppDataSource=new DataSource({
    type:'postgres',
    url:process.env.DATABASE_URL,

    //supbase requires ssl ipv6 connections since ipv4 is for premium users only
    ssl:
    process.env.DATABASE_SSL ==='true'?{rejectUnauthorized:false}:false,

    //we wont use synchronize as it is bad for prod servers
    synchronize:false,

    //cosnole login we want
    logging:true,

     /*
    Automatically loads entity files.
    When we create entities later,
    they will be detected here.
  */
  entities: [__dirname + '/../**/*.entity.{ts,js}'],

  /*
    Location where migration files will be generated.
  */
  migrations: [__dirname + '/migrations/*.{ts,js}'],

  /*
    Table where TypeORM tracks executed migrations.
  */
  migrationsTableName: 'typeorm_migrations',

})