/*
  Matches:
  CREATE TYPE company_role_enum AS ENUM ('OWNER','ADMIN','RECRUITER');
*/
export enum CompanyRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
}

/*
  Matches:
  CREATE TYPE member_status_enum AS ENUM ('ACTIVE','INVITED','REVOKED');
*/
export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  REVOKED = 'REVOKED',
}

/*
  Matches:
  CREATE TYPE job_application_mode_enum AS ENUM ('STANDARD','QUESTIONNAIRE','VIDEO');
*/
export enum ApplicationMode {
  STANDARD = 'STANDARD',
  QUESTIONNAIRE = 'QUESTIONNAIRE',
  VIDEO = 'VIDEO',
}

/*
  Matches:
  CREATE TYPE job_visibility_enum AS ENUM ('PUBLIC','PRIVATE');
*/
export enum JobVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

/*
  Matches:
  CREATE TYPE job_status_enum AS ENUM ('DRAFT','ACTIVE','CLOSED');
*/
export enum JobStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/*
  Matches:
  CREATE TYPE application_status_enum AS ENUM
  ('APPLIED','ACCEPTED','REJECTED','WITHDRAWN');
*/
export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}
