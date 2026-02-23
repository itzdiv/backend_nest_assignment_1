

//creating base classes that will be used by all so we dont have to write code againa and again

import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export abstract class BaseEntity{
    //primarygencolumn tells this shi would autogen
    @PrimaryGeneratedColumn('uuid')
    id:string;

    //auto insert timestampwhen  row first reated
    @CreateDateColumn({type:'timestamptz'})
    created_at:Date;

    //automatically updates column removes need for manually updating each time
    @UpdateDateColumn({type:'timestamptz'})
    updated_at:Date;
}