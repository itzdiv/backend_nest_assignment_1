import { Entity,Column,Index, OneToOne, OneToMany } from "typeorm";
import {BaseEntity} from '../base.entity';
import { CandidateProfile } from "./candidate-profile.entity";
import { Resume } from "./resume.entity";
import { CompanyMember } from "./company-member.entity";
import { ApplicationComment } from './application-comment.entity';
//@entity = table name same in db(must mat exactly)

@Entity({name:'users'})
export class User extends BaseEntity{

    //adding index for faster lookups
    @Index()
    @Column({
        type:'varchar',
        length:255,
        unique:true,
        nullable:false
    })
    email:string;

    @Column({
        type:'text',
        nullable:false
    })
    password_hash:string;

    @Column({
        type:'boolean',
        default:true,
    })
    is_active:boolean;

    @Column({
        type:'boolean',
        default:false,
    })
    is_email_verified:boolean;

    @OneToOne(
        ()=>CandidateProfile,
        (candidateProfile)=>candidateProfile.user,
    )
    candidateProfile: CandidateProfile;

    @OneToMany(
        ()=>Resume,
        (resume)=>resume.user,
    )
    resumes:Resume[];

    @OneToMany(
        ()=>CompanyMember,
        (member)=>member.user
    )
    companyMemberships:CompanyMember[];
    @OneToMany(
  () => ApplicationComment,
  (comment) => comment.user,
)
applicationComments: ApplicationComment[];
}