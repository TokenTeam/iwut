declare module "node-forge/lib/asn1" {
  const asn1: {
    fromDer(bytes: string): unknown;
  };
  export default asn1;
}

declare module "node-forge/lib/util" {
  const util: {
    decode64(input: string): string;
    encode64(input: string): string;
  };
  export default util;
}

declare module "node-forge/lib/forge" {
  const forge: {
    pki: {
      publicKeyFromAsn1(value: unknown): {
        encrypt(content: string, scheme: "RSAES-PKCS1-V1_5"): string;
      };
    };
  };
  export default forge;
}

declare module "node-forge/lib/rsa";
