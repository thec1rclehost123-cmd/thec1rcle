import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stagingConfig = {
    projectId: "c1rcle-staging",
    clientEmail: "firebase-adminsdk-fbsvc@c1rcle-staging.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDF2y/hCjKXtAeD\nPRxC41uDOonZawGkYQrEMXg9ZONvfoMKeUzUCPfx8eEOoFoc4fePMyhi5LA/NtNh\nSv//gCWzuhkraA/SO48RAfnbSwWy7F28WPlW+Pev1Prjdv3e4uq4Mx5QtL6/u/+s\nZrrZOnl0rEFs2ulBFSL4hwb4V5y/s2U7dEQS0Bou5XKzg5DvAoBlDmkCRld/sbHT\nD/nuoorCr+28NL1emHcdYlb0s2i2/xeTiPX+x+G+j4HdPojJTpyqodcNFhus1g11\nxWvF2RA9jvKPI1LSMfFGgzDAoUR6mcwP/Qqsk+zZa2YH4TX4Bx4Alkv+EoQBa9hZ\n3EsZLHszAgMBAAECggEAOrldIxpvPLaK2kl7h2DKyw7HVlgbwymoU+Xo7bPxiyiO\nBUBObMqCqPVlGn2+cT8iRoblEEEXDJQdtg1YIQHsbsUn7kmzFG9n/aDMA2nndZ0R\nDzOLQeSgQzhgBL5PCGXqS6SkdUjIKslGT+mnwIzJ+rabro7k11PKLuCI0ZHTbNPw\Qc/hq1ZF1kAddU1RH8LiSNQZtaMl6CzUFedieqyU2OhJakz6XqXe2g0RP+0Z4aRN\nt3gRrBx2awz6QFEafC19Zu9M6UBoGNzuha3eg3yabm/l+zFAWPCMfYwCaTfcPhd4\n9upRFzNSVKShVQ5cuodcnGT8E2ihxXKQpkaILchDcQKBgQD5n7AE3OOMpOTmYkqS\nP3W+2cNMhO4KMnodFPipT4EYCjSFrnAaBhf8DsbsA6C1YRkbfvf6Uz+oVXFx4YuW\n0Jio+flHX3ivrpaFIdIZ8tfR8i/e7zeqhaQ/rEOPLQWu62QP4JnHP56yPY0EmayV\nfHW2q2Py2Aq3A8hmHFj+6AxkEQKBgQDK6PyQFOx6bCkMVAdkazR4y1KomQzyy9J+\nuKLhs0/pnDDb0PWbkOFTUZIubzI/9PxBPnrsagWTQppy9nZ+N6WNZc2NVbjU3M/7\nX3D/WmV/dCVuzW9AzITHNHfrycLt6n938McHoPAuamxtSul2BTXhcXViRT7YEI2J\n4SJE6pVfAwKBgAlRCnLEA8ImDV0D4iCfObfLzNw4QeIjjCc1tyoqi3joOJmcrxZp\nj8+ahZYddIwQea1rCbpQDRotRjSn5FvWoTv9SG5/g7Oa4odJgdvyElgFn//EEeHN\nZxnxRfw8A/BJXMyy50pmd3fTkEXRrn1Nzd7peqt/oLa/72TQPgoVgxDhAoGAO6mC\nCcN9PQnsj+ltOwOirBnsthI6knGH9SbJDeAxkRkR7LBmZ1WUS3FisDCV7+RS/8Ql\nVLpf5UriKwd5E+e8z/StGe+opz4+EUWg7hRgX7eBAjF5ku4P5Jry3+u1W0tmK5gq\njX2u4Zb9Rq2OM9uYWi+IOlrt/Y3wcCg4cVcgkI0CgYAC8+vKTsSc/6B8Xg3a1r/D\nfC/blQM6DYiMd4eaBnjn+GWX4L2f0TLJ8gSL8YNjr/M/cq6a7ZkXQdpj3g4hoMyl\n789jaLyAbfM0z9qph1/wBYDkJ/WWtNHH1j6dJ113o5I2ygi9wz9LAKKcM7DVLRL0\nuSntREhkskCUO7Rn9tYOBQ==\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
};

initializeApp({
    credential: cert(stagingConfig),
});

const db = getFirestore();

async function check() {
    console.log("Checking Project: c1rcle-staging");
    const eventsSnap = await db.collection("events").limit(5).get();
    console.log("Events count:", eventsSnap.size);
    eventsSnap.forEach(doc => {
        console.log("Event:", doc.id, doc.data().title);
    });
}

check().catch(console.error);
