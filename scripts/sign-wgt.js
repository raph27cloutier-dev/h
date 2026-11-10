// Signs dist/wgt with a Tizen developer author certificate + the public distributor one.
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const base = path.dirname(require.resolve('@tizentv/webide-common-tizentv'));
const { TizenCertManager } = require('@tizentv/webide-common-tizentv');
const PackageSigner = require(path.join(base, 'lib/packageSigner.js'));
const cryptUtil = require(path.join(base, 'lib/cryptUtil.js'));
(async () => {
  const [signingDir, wgtDir] = process.argv.slice(2);
  const mgr = new TizenCertManager(signingDir);
  await mgr.init();
  const pwdFile = path.join(signingDir, 'author.pwd');
  const p12 = path.join(signingDir, 'Author', 'myhome.p12');
  if (!fs.existsSync(p12)) {
    fs.writeFileSync(pwdFile, crypto.randomBytes(18).toString('hex'), { mode: 0o600 });
    mgr.createCert({ keyFileName: 'myhome', authorName: 'My Home', authorPassword: fs.readFileSync(pwdFile, 'utf8'),
      countryInfo: 'CA', stateInfo: 'QC', cityInfo: '', organizationInfo: '', departmentInfo: '', emailInfo: '' });
  }
  const dist = mgr.getTizenDistributorProfile('public');
  const signer = new PackageSigner();
  signer.profileInfo.author = cryptUtil.parseP12File(p12, fs.readFileSync(pwdFile, 'utf8'));
  signer.profileInfo.distributor1 = cryptUtil.parseP12File(dist.distributorCertPath, dist.distributorPassword);
  signer.signPackage(path.resolve(wgtDir), '');
  console.log('signed', fs.readdirSync(wgtDir).filter(f => /signature/.test(f)).join(' '));
})().catch(e => { console.error('SIGN FAILED', e); process.exit(1); });
