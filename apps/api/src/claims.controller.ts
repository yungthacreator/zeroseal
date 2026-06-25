import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { parseOrThrow } from "./common";
import {
  attachEvidenceSchema,
  createClaimSchema,
  recordTransactionSchema,
  requestVerificationSchema,
  submitProofSchema,
} from "./claims.schemas";
import { ClaimsService } from "./claims.service";
import { TransactionsService } from "./transactions.service";
import { ReceiptsService } from "./receipts.service";
import { stellarPublicKey, transactionHash } from "./validators";
import { ProgrammesService } from "./programmes.service";

@ApiTags("claims")
@Controller("api/v1")
export class ClaimsController {
  constructor(
    @Inject(ClaimsService)
    private readonly claims: ClaimsService,
    @Inject(TransactionsService)
    private readonly transactions: TransactionsService,
    @Inject(ReceiptsService)
    private readonly receipts: ReceiptsService,
    @Inject(ProgrammesService)
    private readonly programmes: ProgrammesService,
  ) {}

  @Post("claims")
  createClaim(@Body() body: unknown) {
    return this.claims.createClaim(parseOrThrow(createClaimSchema, body));
  }

  @Get("claims/:claimId")
  getClaim(@Param("claimId") claimId: string) {
    return this.claims.getClaim(claimId);
  }

  @Get("claims/:claimId/status")
  getStatus(@Param("claimId") claimId: string) {
    return this.claims.getStatus(claimId);
  }

  @Post("claims/:claimId/proof")
  submitProof(@Param("claimId") claimId: string, @Body() body: unknown) {
    const input = parseOrThrow(submitProofSchema, body);
    return this.claims.submitProof(claimId, input.artifact);
  }

  @Post("claims/:claimId/evidence")
  attachEvidence(@Param("claimId") claimId: string, @Body() body: unknown) {
    return this.claims.attachEvidence(
      claimId,
      parseOrThrow(attachEvidenceSchema, body),
    );
  }

  @Post("claims/:claimId/verification")
  requestVerification(@Param("claimId") claimId: string, @Body() body: unknown) {
    parseOrThrow(requestVerificationSchema, body ?? {});
    return this.claims.requestVerification(claimId);
  }

  @Post("claims/:claimId/transactions")
  recordTransaction(@Param("claimId") claimId: string, @Body() body: unknown) {
    return this.claims.recordTransaction(
      claimId,
      parseOrThrow(recordTransactionSchema, body),
    );
  }

  @Get("claims/:claimId/transactions")
  getClaimTransactions(@Param("claimId") claimId: string) {
    return this.transactions.transactionsForClaim(claimId);
  }

  @Get("claims/:claimId/receipt")
  getClaimReceipt(@Param("claimId") claimId: string) {
    return this.receipts.getForClaim(claimId);
  }

  @Get("wallets/:address/claims")
  getWalletClaims(@Param("address") address: string) {
    return this.claims.claimsForWallet(stellarPublicKey.parse(address));
  }

  @Get("wallets/:address/activity")
  getWalletActivity(@Param("address") address: string) {
    return this.transactions.walletActivity(stellarPublicKey.parse(address));
  }

  @Get("wallets/:address/researcher-registration")
  recoverResearcherRegistration(
    @Param("address") address: string,
    @Query("researcherCommitment") researcherCommitment?: string,
  ) {
    return this.transactions.recoverResearcherRegistration(
      stellarPublicKey.parse(address),
      researcherCommitment,
    );
  }

  @Get("transactions/:transactionHash")
  getTransaction(@Param("transactionHash") hash: string) {
    return this.transactions.getTransaction(transactionHash.parse(hash));
  }

  @Get("receipts/:receiptId")
  getReceipt(@Param("receiptId") receiptId: string) {
    return this.receipts.getByReceiptId(receiptId);
  }

  @Get("programmes")
  getProgrammes() {
    return this.programmes.listProgrammes();
  }

  @Get("programmes/:programmeId")
  getProgramme(@Param("programmeId") programmeId: string) {
    return this.programmes.getProgramme(programmeId);
  }

  @Get("programmes/:programmeId/snapshots")
  getProgrammeSnapshots(@Param("programmeId") programmeId: string) {
    return this.programmes.getProgrammeSnapshots(programmeId);
  }

  @Get("programmes/:programmeId/policies")
  getProgrammePolicies(@Param("programmeId") programmeId: string) {
    return this.programmes.getProgrammePolicies(programmeId);
  }

  @Get("circuits")
  getCircuits() {
    return this.programmes.listCircuits();
  }
}
