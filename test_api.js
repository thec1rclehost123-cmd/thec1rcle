const fetch = require('node-fetch');

async function main() {
  const res = await fetch('http://127.0.0.1:4000/api/v1/profiles/h8ktZ5jmXselI6vxkcMHc45YceP2');
  const data = await res.json();
  console.log(JSON.stringify(data.orders, null, 2));
}

main().catch(console.error);
