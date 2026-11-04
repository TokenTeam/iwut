import asn1 from "node-forge/lib/asn1";
import forge from "node-forge/lib/forge";
import "node-forge/lib/rsa";
import util from "node-forge/lib/util";

export function encryptRsa(content: string, publicKeyBase64: string): string {
  const der = util.decode64(publicKeyBase64.replace(/\s+/g, ""));
  const publicKey = forge.pki.publicKeyFromAsn1(asn1.fromDer(der));
  const encrypted = publicKey.encrypt(content, "RSAES-PKCS1-V1_5");
  return util.encode64(encrypted).replace(/\r?\n/g, "");
}
