export type ReportingPath = {
  id: string;
  name: string;
  shortCategory: string;
  logo?: string;
  accessibleLabel: string;
};

const REPORTING_PATH_DEFINITIONS = [
  {
    id: "hackerone",
    name: "HackerOne",
    shortCategory: "Bug bounty and vulnerability disclosure",
    logo: "/brands/hackerone.svg",
    accessibleLabel: "HackerOne, bug bounty and vulnerability disclosure",
  },
  {
    id: "bugcrowd",
    name: "Bugcrowd",
    shortCategory: "Bug bounty and vulnerability disclosure",
    accessibleLabel: "Bugcrowd, bug bounty and vulnerability disclosure",
  },
  {
    id: "intigriti",
    name: "Intigriti",
    shortCategory: "Bug bounty and vulnerability disclosure",
    accessibleLabel: "Intigriti, bug bounty and vulnerability disclosure",
  },
  {
    id: "yeswehack",
    name: "YesWeHack",
    shortCategory: "Bug bounty and vulnerability disclosure",
    accessibleLabel: "YesWeHack, bug bounty and vulnerability disclosure",
  },
  {
    id: "immunefi",
    name: "Immunefi",
    shortCategory: "Web3 bug bounty",
    logo: "/brands/immunefi.svg",
    accessibleLabel: "Immunefi, Web3 bug bounty",
  },
  {
    id: "hackenproof",
    name: "HackenProof",
    shortCategory: "Bug bounty and Web3 disclosure",
    accessibleLabel: "HackenProof, bug bounty and Web3 disclosure",
  },
  {
    id: "code4rena",
    name: "Code4rena",
    shortCategory: "Smart-contract audit competition",
    logo: "/brands/code4rena.svg",
    accessibleLabel: "Code4rena, smart-contract audit competition",
  },
  {
    id: "codehawks",
    name: "CodeHawks",
    shortCategory: "Smart-contract audit competition",
    logo: "/brands/codehawks.svg",
    accessibleLabel: "CodeHawks, smart-contract audit competition",
  },
  {
    id: "cantina",
    name: "Cantina",
    shortCategory: "Security review and competition",
    logo: "/brands/cantina.svg",
    accessibleLabel: "Cantina, security review and competition",
  },
  {
    id: "sherlock",
    name: "Sherlock",
    shortCategory: "Smart-contract audit competition",
    accessibleLabel: "Sherlock, smart-contract audit competition",
  },
  {
    id: "hats-finance",
    name: "Hats Finance",
    shortCategory: "Web3 bug bounty",
    accessibleLabel: "Hats Finance, Web3 bug bounty",
  },
  {
    id: "direct-to-project",
    name: "Direct to project",
    shortCategory: "Private report to the project security team",
    accessibleLabel: "Direct to project, private report to the project security team",
  },
  {
    id: "other",
    name: "Other",
    shortCategory: "Custom disclosure route",
    accessibleLabel: "Other, custom disclosure route",
  },
] as const satisfies readonly ReportingPath[];

export const REPORTING_PATHS: readonly ReportingPath[] = REPORTING_PATH_DEFINITIONS;

export const REPORTING_PATH_NAMES = REPORTING_PATHS.map((path) => path.name);

export function findReportingPath(value: string | null | undefined): ReportingPath | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return (
    REPORTING_PATHS.find(
      (path) =>
        path.id.toLowerCase() === normalized ||
        path.name.toLowerCase() === normalized,
    ) ?? null
  );
}
