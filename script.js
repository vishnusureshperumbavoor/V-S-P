const bodyElement = document.body;
document.addEventListener("DOMContentLoaded", function () {
  const vspbotToggler = document.querySelector(".vspbot-toggler");
  const vspbotHeader = document.querySelector(".vspbot header");
  const firstIcon = vspbotToggler.querySelector(".fa-robot");
  const closeIcon = vspbotToggler.querySelector(".fa-xmark");
  const closeIconHeader = vspbotHeader.querySelector(".fa-xmark");
  const userInputTextArea = document.getElementById("user-input");

  vspbotToggler.addEventListener("click", function () {
    bodyElement.classList.toggle("show-vspbot");
    firstIcon.classList.toggle("hidden");
    closeIcon.classList.toggle("hidden");
  });

  closeIconHeader.addEventListener("click", function () {
    bodyElement.classList.remove("show-vspbot");
  });

  userInputTextArea.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the newline character from being added
      sendMessage();
    }
  });

  function getResponse(userMessage) {
    fetch("https://vishnusureshperumbavoor-vspbot-falcon-langchain.hf.space/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: [userMessage] }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Success:", data);
        return data;
      }
      )
      .catch((error) => {
        console.error("Error:", error);
    });
  }

  function sendMessage() {
    const userMessage = userInputTextArea.value.trim();
    if (userMessage) {
      const inputChat = document.getElementById("input-text");
      const chatbox = document.querySelector(".chatbox");
      const userChatItem = document.createElement("li");
      userChatItem.className = "chat outgoing";
      userChatItem.innerHTML = `<p>${userMessage}</p>`;
      chatbox.appendChild(userChatItem);
      chatbox.scrollTop = chatbox.scrollHeight;
      userInputTextArea.value = "";

      setTimeout(async () => {
        const botResponse = await getResponse(userMessage);
        console.log(botResponse);
        const botChatItem = document.createElement("li");
        botChatItem.className = "chat incoming";
        botChatItem.innerHTML = `
                <span class="fa-solid fa-robot"></span>
                <p>${botResponse}</p>
            `;
        chatbox.appendChild(botChatItem);
        chatbox.scrollTop = chatbox.scrollHeight;
      }, 500);
    }
  }
});
