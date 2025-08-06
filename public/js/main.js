document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messages = document.getElementById('messages');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const username = document.getElementById('chat-container').dataset.username;
    const anonymousToggleBtn = document.getElementById('anonymous-toggle-btn');
    const anonymousStatusIndicator = anonymousToggleBtn.querySelector('span');

    let isAnonymousMode = false;

    // Handle incoming messages from the server
    socket.on('chat-message', data => {
        appendMessage({
            name: data.name,
            message: data.message,
            timestamp: data.created_at,
            isOwnMessage: data.name === username,
            profilePicUrl: data.profile_pic_url || '/img/default-profile.png'
        });
        messages.scrollTop = messages.scrollHeight;
    });

    // Helper function to append a system message to the chat
function appendSystemMessage(text) {
    const messages = document.getElementById('messages');
    const systemMessageElement = document.createElement('div');
    systemMessageElement.classList.add('text-center', 'text-gray-500', 'my-3', 'flex', 'items-center', 'justify-center', 'space-x-2', 'text-sm');
    
    // Using the ghost icon as you requested
    systemMessageElement.innerHTML = `
        <i class="fas fa-ghost"></i>
        <span>${text}</span>
        <i class="fas fa-ghost"></i>
    `;
    
    messages.appendChild(systemMessageElement);
    messages.scrollTop = messages.scrollHeight; // Scroll to bottom to make it visible
}

    // Handle form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();

        if (message) {
            // Emit message to server with anonymous flag
            socket.emit('send-chat-message', { message, isAnonymous: isAnonymousMode });

            // Clear input
            messageInput.value = '';

            // Clear input height (if it's a textarea)
            if (messageInput.style) {
                messageInput.style.height = 'auto';
            }
        }
    });

    // Toggle anonymous mode when the button is clicked
anonymousToggleBtn.addEventListener('click', () => {
    isAnonymousMode = !isAnonymousMode;
    if (isAnonymousMode) {
        anonymousStatusIndicator.classList.remove('bg-gray-500');
        anonymousStatusIndicator.classList.add('bg-red-500');
        // Display the inline notification instead of an alert
        appendSystemMessage("Now you're appearing as Anonymous!");
    } else {
        anonymousStatusIndicator.classList.remove('bg-red-500');
        anonymousStatusIndicator.classList.add('bg-gray-500');
        // Display the inline notification instead of an alert
        appendSystemMessage("You have exited Anonymous mode.");
    }
});

    // Auto-resize textarea (if you change the input to a textarea)
    messageInput.addEventListener('input', () => {
        if (messageInput.style) {
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
        }
    });

    // Helper function to append a message to the chat
    function appendMessage({ name, message, timestamp, isOwnMessage, profilePicUrl }) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        // Use a generic placeholder if profilePicUrl is not provided (for anonymous messages)
        const effectiveProfilePicUrl = profilePicUrl || '/img/default-profile.png';

        // Check if the message is from the logged-in user and in anonymous mode
        const isAnonymousMessage = name === 'anonymous';

        if (isOwnMessage) {
            messageElement.classList.add('own-message');
            messageElement.innerHTML = `
                <div class="chat-bubble own-bubble">
                    <p class="mb-1">${message}</p>
                    <span class="chat-timestamp">${formatTime(timestamp)}</span>
                </div>
            `;
        } else {
            // Handle anonymous messages from other users
            if (isAnonymousMessage) {
                messageElement.classList.add('anonymous-message');
            }
            messageElement.innerHTML = `
                <div class="chat-profile-pic">
                    <img src="${effectiveProfilePicUrl}" alt="${name}" onerror="this.src='/img/default-profile.png'">
                </div>
                <div class="chat-bubble other-bubble">
                    <span class="chat-sender-name">${name}</span>
                    <p class="mb-1">${message}</p>
                    <span class="chat-timestamp">${formatTime(timestamp)}</span>
                </div>
            `;
        }

        // If this is the first message, remove the "No messages" placeholder
        const placeholder = messages.querySelector('.text-center');
        if (placeholder) {
            placeholder.remove();
        }

        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }

    // Format time to HH:MM AM/PM
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Scroll to the bottom of the chat on page load
    messages.scrollTop = messages.scrollHeight;
});