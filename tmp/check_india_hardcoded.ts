import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirebaseEventRepository } from '../packages/core/src/infrastructure/repositories/firebase/event-repository';

// Credentials for thec1rcle-india
const indiaConfig = {
    projectId: "thec1rcle-india",
    clientEmail: "firebase-adminsdk-fbsvc@thec1rcle-india.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDBQAxxY6wmI4Dp\nzMpfCKJcm/SnXHaUMO7gdN6osN2vRrw92UOEyokVUq3QLGOMDsX50IiEayaqYbfz\nfmuk4fvezwuFi3jqMeP96TWGQ1jiiDgxr1Zaya9h1Dljdkr3eupFzjXytKESNouB\nhtA1G+XPl3zOroHGasC7dEl1q9p2mAOdW73Z3S/GTm2X5j57ZS0gnb2XY8u91DgZ\nxBOY7V26S/KLrwuvaYyraGrUO8/6drKQw+7CHLNKy0RoFIC12eNRoAukZCdzk1Rz\n7oHurxYZjEB/ZzsKAbDIs+Of8zhEq6t+Hc00ZMLSXBb3/KlUCVZ5fp/zyb36zW+a\ncRKCw1WLAgMBAAECggEAN4AzkqUznch4j603Oc/7AWnw+9f8XlcnY+Nsxzn0kRBZ\no9GwKIUalbsnHDCDbogXp8WST6WOd0SVViMquzID6lvATVxfH7OwbQ37R1I0Rusk\naHCY9n4SFqCi0sP4h9cPTXkJ2WizEc4EhvC2/2nBuLsjJyDLOLcUH0IojtkKZyCF\nhjkwUTw9RkLnD/kgdhbgHykvJP0UZhLK2SO9GyM9j5cbS2zSoTeb48Cx+kyLg56x\nO1Vb6BR0HKWGGQtKaETutgk7f2hhYBFeyjQjfv6eqrq3BdlvX0iY8mWWy8Yj7+0N\nC3NBtAJv8OjMNI0SOiFOcZ1LIUnYtTYNqmxhTaKh8QKBgQDq2y7xWeQgpjv6DQij\nmcz9HiWhKPrNMc48G6Xdpor4qNkVNNWVKW0HUJP/LMgdESQbUIS9RoYB+2/UqGbH\navAnAKpaZHEOtzBtah2y8/ClLVCtnRbfOumEMjwu72Sh/XaJwkG9tdhX9zUS3bjR\nFzhvRr0+fEKS4KD2+AXKVcgBHQKBgQDSpfTkFBTTWu9skRemC3e7gIieX7fHvvvv\nJ3UXXA9rJnCRTUXPAvoxlKdZofopdNcG3H0Bzg+Tng7hHq1SvwxZxtPi6Y6Z29Sr\nfd/2162+WWBawhmqYuliG7JdYRYqsUhgszt/VSUTro7U6mYi1j4qpbA0vRIeB+Ir\niXJiq6LYxwKBgFaUNtoCqXbf0Xx9EZI+QLOPSY//63V5xu2hw6PSoajJlj2bHKHA\ng9EOg4CuoZcVmpn3NPgR55UTfEaJTlp1sdKvDB4GqScjoVa0p/4wr6Y07mkSYDwr\nG6sAWe9zkUWmiux+EH4/a2ICYC50To3GYaekDF/cry42YSCqjnfo57KBAoGBAK/S\nkbul/1QC/QETgje4LrI0sNPwdQemo8aUmqlqz/vR0/eUFgaaJ5cmyyCHkLT1r10s\nwLK2+k1uimDhKC5/BKIS0Vz/MWW/E71hDYWNtJnDJCfdB2susDqRf6ltlgEAhLci\nIzE/MnlhJBsXozTEupMCRTdf8TVbwy4vxWgSdxSVAoGBANoB4Bf03FvO1nzEFuoo\nOcd6IVoYYXifPu57e+jgI63RPhShwNjDRXiuOQKtbmMFuMw52KATx7irkWAMcj1h\nu8/OxNGhRlrd2TKtv2ccXjhuYSt4dUu6tRdsoysibN9LfGkKVtEirPKpME2VuXNf\nK3CBYTeS06Sv3N20LHtB/sVQ\n-----END PRIVATE KEY-----\n".replace(/\\n/g, "\n"),
};

initializeApp({
    credential: cert(indiaConfig),
});

const db = getFirestore();
const repo = new FirebaseEventRepository(db);

async function testQuery() {
    console.log("Starting FirebaseEventRepository query...");
    try {
        const events = await repo.list({ limit: 50 }, undefined);
        console.log(`Query finished. Found ${events.length} events.`);
    } catch (err: any) {
        console.error("Query failed:", err.message);
    }
}

testQuery();
