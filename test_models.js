const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyBnABQkMpGNvFNyx6E7MsGndVkDdU7BK8I");
async function run() {
  // We can't directly list models from the JS SDK without an unexposed API, or maybe we can fetch it via REST.
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyBnABQkMpGNvFNyx6E7MsGndVkDdU7BK8I`);
  const data = await response.json();
  console.log(data.models.map(m => m.name));
}
run();
