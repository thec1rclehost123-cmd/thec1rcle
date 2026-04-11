import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Credentials for thec1rcle-india
const indiaConfig = {
    projectId: "thec1rcle-india",
    clientEmail: "firebase-adminsdk-fbsvc@thec1rcle-india.iam.gserviceaccount.com",
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDBQAxxY6wmI4Dp
zMpfCKJcm/SnXHaUMO7gdN6osN2vRrw92UOEyokVUq3QLGOMDsX50IiEayaqYbfz
fmuk4fvezwuFi3jqMeP96TWGQ1jiiDgxr1Zaya9h1Dljdkr3eupFzjXytKESNouB
htA1G+XPl3zOroHGasC7dEl1q9p2mAOdW73Z3S/GTm2X5j57ZS0gnb2XY8u91DgZ
xBOY7V26S/KLrwuvaYyraGrUO8/6drKQw+7CHLNKy0RoFIC12eNRoAukZCdzk1Rz
7oHurxYZjEB/ZzsKAbDIs+Of8zhEq6t+Hc00ZMLSXBb3/KlUCVZ5fp/zyb36zW+a
cRKCw1WLAgMBAAECggEAN4AzkqUznch4j603Oc/7AWnw+9f8XlcnY+Nsxzn0kRBZ
o9GwKIUalbsnHDCDbogXp8WST6WOd0SVViMquzID6lvATVxfH7OwbQ37R1I0Rusk
aHCY9n4SFqCi0sP4h9cPTXkJ2WizEc4EhvC2/2nBuLsjJyDLOLcUH0IojtkKZyCF
hjkwUTw9RkLnD/kgdhbgHykvJP0UZhLK2SO9GyM9j5cbS2zSoTeb48Cx+kyLg56x
O1Vb6BR0HKWGGQtKaETutgk7f2hhYBFeyjQjfv6eqrq3BdlvX0iY8mWWy8Yj7+0N
C3NBtAJv8OjMNI0SOiFOcZ1LIUnYtTYNqmxhTaKh8QKBgQDq2y7xWeQgpjv6DQij
mcz9HiWhKPrNMc48G6Xdpor4qNkVNNWVKW0HUJP/LMgdESQbUIS9RoYB+2/UqGbH
avAnAKpaZHEOtzBtah2y8/ClLVCtnRbfOumEMjwu72Sh/XaJwkG9tdhX9zUS3bjR
FzhvRr0+fEKS4KD2+AXKVcgBHQKBgQDSpfTkFBTTWu9skRemC3e7gIieX7fHvvvv
J3UXXA9rJnCRTUXPAvoxlKdZofopdNcG3H0Bzg+Tng7hHq1SvwxZxtPi6Y6Z29Sr
fd/2162+WWBawhmqYuliG7JdYRYqsUhgszt/VSUTro7U6mYi1j4qpbA0vRIeB+Ir
iXJiq6LYxwKBgFaUNtoCqXbf0Xx9EZI+QLOPSY//63V5xu2hw6PSoajJlj2bHKHA
g9EOg4CuoZcVmpn3NPgR55UTfEaJTlp1sdKvDB4GqScjoVa0p/4wr6Y07mkSYDwr
G6sAWe9zkUWmiux+EH4/a2ICYC50To3GYaekDF/cry42YSCqjnfo57KBAoGBAK/S
kbul/1QC/QETgje4LrI0sNPwdQemo8aUmqlqz/vR0/eUFgaaJ5cmyyCHkLT1r10s
wLK2+k1uimDhKC5/BKIS0Vz/MWW/E71hDYWNtJnDJCfdB2susDqRf6ltlgEAhLci
IzE/MnlhJBsXozTEupMCRTdf8TVbwy4vxWgSdxSVAoGBANoB4Bf03FvO1nzEFuoo
Ocd6IVoYYXifPu57e+jgI63RPhShwNjDRXiuOQKtbmMFuMw52KATx7irkWAMcj1h
u8/OxNGhRlrd2TKtv2ccXjhuYSt4dUu6tRdsoysibN9LfGkKVtEirPKpME2VuXNf
K3CBYTeS06Sv3N20LHtB/sVQ
-----END PRIVATE KEY-----`
};

initializeApp({ credential: cert(indiaConfig) });
const db = getFirestore();

async function main() {
    const eventId = '6c16c24d-32b3-4c75-8c12-6644a0687d53';
    console.log(`Checking event with ID: ${eventId}...`);
    
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) {
        console.log("Event does not exist in DB!");
    } else {
        console.log("Event workspaceId:", doc.data()?.workspaceId);
    }
    
    // Also check by slug
    const slugQuery = await db.collection('events').where('slug', '==', eventId).get();
    if (!slugQuery.empty) {
        console.log("Event workspaceId by slug:", slugQuery.docs[0].data()?.workspaceId);
    }
}

main();
