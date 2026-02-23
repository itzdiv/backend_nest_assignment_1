/*
  Shared TypeScript types used across the application.

  These are NOT database entities — they are interface
  contracts for request/response shaping.
*/

/*
  AuthenticatedRequest — extends Express Request
  with the user property attached by JwtAuthGuard.

  Used for typing controller method parameters
  when working with @Req() decorator.
*/
import { User } from 'src/db/entities/user.entity';
import { CompanyMember } from 'src/db/entities/company-member.entity';

export interface AuthenticatedRequest extends Request {
  /*
    User entity attached by JwtAuthGuard after
    verifying the JWT token and fetching from DB.
  */
  user: User;

  /*
    CompanyMember entity attached by CompanyMembershipGuard
    after verifying the user belongs to the company.
  */
  membership?: CompanyMember;
}
