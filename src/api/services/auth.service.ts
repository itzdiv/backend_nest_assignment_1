import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/db/entities/user.entity";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { LoginDto, RegisterDto } from "src/zod/auth.zod";


@Injectable()
export class AuthService{

    constructor(
        //injecting user repo of type orm into this
        @InjectRepository(User)
        private readonly userRepository:Repository<User>,
        ){}

        //registering the user
        async register(data:RegisterDto){
            const existingUser=await this.userRepository.findOne({
                where:{email:data.email},
            });
            if(existingUser){
                throw new BadRequestException('Email already registered');
            }

            //if user not found that means we can register and create password hashes
            const hashedPassword=await bcrypt.hash(data.password,10);

            const user=this.userRepository.create({
                email:data.email,
                password_hash:hashedPassword,
                is_active:true,
                is_email_verified:false,
            });

            await this.userRepository.save(user);
            return{
                message:'User Registered Sucessfully',
            };
        }

        //verifying login
        async login(data:LoginDto){
            const user = await this.userRepository.findOne({
                where:{email:data.email},
            })

            if(!user){
                throw new UnauthorizedException("Invalide Credentials");

            }
            //work when user exist only
            const isPasswordValid=await bcrypt.compare(
                data.password,
                user.password_hash,
            );

            if(!isPasswordValid){
                throw new UnauthorizedException("Invalide Credentials");
            }

            const token=jwt.sign(
                {
                    user_id:user.id
                },
                process.env.JWT_SECRET!,
                {
                    expiresIn:'7d',
                },
            );
            return{
                acess_token:token
            }
        }
}