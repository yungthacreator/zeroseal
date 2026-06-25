import { Inject, Injectable } from "@nestjs/common";
import { ChainTransactionStatus, ClaimStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { StellarService } from "./stellar.service";
import type { RegistrationRecoveryOptions } from "./stellar.service";
import { ApiError } from "./common";
import { assertTransition } from "./lifecycle";
import { ReceiptsService } from "./receipts.service";

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StellarService)
    private readonly stellar: StellarService,
    @Inject(ReceiptsService)
    private readonly receipts: ReceiptsService,
  ) {}

  async getTransaction(hash: string) {
    const normalized = this.stellar.validateTransactionHash(hash);
    const tx = await this.prisma.chainTransaction.findFirst({
      where: { transactionHash: normalized },
    });

    if (!tx) {
      throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
    }

    return tx;
  }

  async transactionsForClaim(claimId: string) {
    return this.prisma.chainTransaction.findMany({
      where: { claimId },
      orderBy: { createdAt: "desc" },
    });
  }

  async walletActivity(address: string) {
    return this.prisma.chainTransaction.findMany({
      where: { walletAccount: { address } },
      orderBy: { createdAt: "desc" },
    });
  }

  async recoverResearcherRegistration(
    address: string,
    researcherCommitment?: string,
    options: RegistrationRecoveryOptions = {},
  ) {
    const recovered = await this.stellar.recoverResearcherRegistration(
      address,
      researcherCommitment,
      options,
    );

    if (!recovered) {
      return {
        status: "PROVENANCE_UNAVAILABLE",
        message: "Registry state may exist, but transaction provenance was not recovered.",
      };
    }

    const wallet = await this.prisma.walletAccount.upsert({
      where: { address },
      update: { network: "TESTNET" },
      create: { address, network: "TESTNET" },
    });

    const record = await this.prisma.chainTransaction.upsert({
      where: {
        network_transactionHash: {
          network: "TESTNET",
          transactionHash: recovered.hash,
        },
      },
      update: {
        walletAccountId: wallet.id,
        ledgerNumber: recovered.ledger,
        sourceAccount: recovered.sourceAccount,
        contractId: recovered.contractId,
        method: recovered.method,
        operationType: "researcher_registration",
        researcherCommitment: recovered.researcherCommitment,
        status: ChainTransactionStatus.CONFIRMED,
        feeCharged: recovered.feeCharged,
        confirmedAt: recovered.createdAt,
        rawResponseDigest: this.stellar.rawDigest(recovered),
      },
      create: {
        network: "TESTNET",
        transactionHash: recovered.hash,
        walletAccountId: wallet.id,
        ledgerNumber: recovered.ledger,
        sourceAccount: recovered.sourceAccount,
        contractId: recovered.contractId,
        method: recovered.method,
        operationType: "researcher_registration",
        researcherCommitment: recovered.researcherCommitment,
        status: ChainTransactionStatus.CONFIRMED,
        feeCharged: recovered.feeCharged,
        confirmedAt: recovered.createdAt,
        rawResponseDigest: this.stellar.rawDigest(recovered),
        idempotencyKey: `recover:register_researcher:${recovered.hash}`,
      },
    });

    return {
      status: "RECOVERED",
      transaction: record,
      researcherCommitment: recovered.researcherCommitment,
      explorer: {
        transaction: recovered.explorerTransactionUrl,
        account: recovered.explorerAccountUrl,
        registry: recovered.explorerRegistryUrl,
        verifier: recovered.explorerVerifierUrl,
      },
    };
  }

  async reconcile(transactionId: string) {
    const txRecord = await this.prisma.chainTransaction.findUnique({
      where: { id: transactionId },
      include: {
        claim: true,
        walletAccount: true,
      },
    });

    if (!txRecord) {
      throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
    }

    if (txRecord.status === ChainTransactionStatus.CONFIRMED || txRecord.status === ChainTransactionStatus.FAILED) {
      return txRecord;
    }

    const chain = await this.stellar.fetchTransaction(txRecord.transactionHash);
    if (!chain) {
      return this.prisma.chainTransaction.update({
        where: { id: txRecord.id },
        data: { status: ChainTransactionStatus.PENDING },
      });
    }

    if (!chain.successful) {
      return this.prisma.$transaction(async (prisma) => {
        const updated = await prisma.chainTransaction.update({
          where: { id: txRecord.id },
          data: {
            status: ChainTransactionStatus.FAILED,
            failedAt: new Date(),
            rawResponseDigest: this.stellar.rawDigest(chain),
          },
        });

        if (txRecord.claim && txRecord.method !== "register_researcher") {
          await prisma.claim.update({
            where: { id: txRecord.claim.id },
            data: { status: ClaimStatus.TRANSACTION_FAILED },
          });
        }

        return updated;
      });
    }

    if (txRecord.walletAccount && chain.sourceAccount && chain.sourceAccount !== txRecord.walletAccount.address) {
      throw new ApiError("TRANSACTION_SOURCE_MISMATCH", "Confirmed transaction source does not match the claim wallet.", 422);
    }

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.chainTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: ChainTransactionStatus.CONFIRMED,
          ledgerNumber: chain.ledger,
          sourceAccount: chain.sourceAccount ?? txRecord.sourceAccount,
          feeCharged: chain.feeCharged,
          confirmedAt: chain.createdAt ?? new Date(),
          rawResponseDigest: this.stellar.rawDigest(chain),
        },
      });

      if (txRecord.claim && txRecord.method !== "register_researcher") {
        assertTransition(txRecord.claim.status, ClaimStatus.CONFIRMED);
        await prisma.claim.update({
          where: { id: txRecord.claim.id },
          data: { status: ClaimStatus.CONFIRMED },
        });
      }

      return updated;
    }).then(async (updated) => {
      if (updated.claimId && updated.method !== "register_researcher") {
        try {
          await this.receipts.issueIfReady(updated.claimId);
        } catch (error) {
          if (!(error instanceof ApiError && error.code === "RECEIPT_NOT_READY")) {
            throw error;
          }
        }
      }
      return updated;
    });
  }
}
