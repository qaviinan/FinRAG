import { Key, Mic, Send, Settings, Trash } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Head from 'next/head';
import WelcomeScreen from '../components/WelcomeScreen';
import MessageRenderer from '../components/MessageRenderer';
import LoadingAnimation from '../components/LoadingAnimation';

export default function SynthWave() {
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    console.log(messages); // Check what's currently in the messages state
  }, [messages]);

  useEffect(() => {
    // This code now runs only client-side
    const storedSessionId = localStorage.getItem('sessionId') || uuidv4();
    localStorage.setItem('sessionId', storedSessionId);  // Ensure a session ID exists
    setSessionId(storedSessionId);

    const savedMessages = localStorage.getItem('messages');
    setMessages(savedMessages ? JSON.parse(savedMessages) : []);

  }, []);

  useEffect(() => {
      if (messages.length > 0) {
          localStorage.setItem('messages', JSON.stringify(messages));
      }
  }, [messages]);


  const handleNewChat = () => {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('messages');
    const newSessionId = uuidv4();
    localStorage.setItem('sessionId', newSessionId);
    setSessionId(newSessionId);
    setMessages([]);
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value); 
    if (e.target.value.length > 0) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
  };
  
  const handleSampleQuery = (query) => {
    setInputText(query); // Set input box text
    setIsTyping(true);
  };  

  const handleSubmit = (event) => {
    event.preventDefault();
    const userInput = event.target.elements.chatInput.value;
    if (inputText.trim()) { // Ensure we don't send empty messages
      // Add the user's question immediately to the messages
      setMessages(prevMessages => [...prevMessages, { type: 'user', content: `Q: ${userInput}` }]);
      setInputText("");
      setLoading(true);

      // backend ip: http://13.56.89.104:8000/chat
      // localhost ip: http://localhost:8000/chat
      fetch("http://localhost:8000/chat", {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          query: userInput
        })
      })
      .then(response => response.json())
      .then(data => {
        // Assuming `data` is an array of different response types as described
        data.forEach(item => {
          setMessages(prevMessages => [...prevMessages, item]);
          setLoading(false); 
          // setCurrentDataFrame(item.df_name);
        });
      })
      .catch(error => console.error('Error:', error));
    }
  };  

  return (
    <>
      <Head>
      <title>FinRAG - Agent with trade know-how</title>
      </Head>
      <main>
        <div className=" bg-slate-200 drawer drawer-mobile">
          <input id="sidebar" type="checkbox" className="drawer-toggle" />
          <div
            className="drawer-content "
            style={{
              scrollBehavior: "smooth",
              scrollPaddingTop: "5rem",
            }}
          >
            <div
              className="  top-0  flex h-20 w-full justify-center bg-opacity-0 backdrop-blur transition-all duration-100 text-base-content"
            >
              <nav className="navbar w-full ">
                <div className="flex  flex-1 md-gap-1 lg:gap-2">
                  <span
                    className="tooltip tooltip-bottom before:text-xs before:content-[attr(data-tip)]"
                    data-tip="Menu"
                  >
                    <label
                      htmlFor="sidebar"
                      className="btn btn-square btn-ghost drawer-button lg:hidden"
                    >
                      <svg
                        width="20"
                        height="20"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="inline-block h-5 w-5 stroke-slate-800 md:h-6 md:w-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 6h16M4 12h16M4 18h16"
                        ></path>
                      </svg>
                    </label>
                  </span>
                </div>
              </nav>
            </div>
            <div className="flex flex-col polka  items-center justify-around px-6 py-3 pb-16 xl:pr-2 bg-stone-200   min-h-screen">
              {messages.length === 0 && <WelcomeScreen onClickSample={handleSampleQuery} />}
              <div className="chat-messages">
                {
                  messages.map((message, index) => (
                    <div key={index} className="message-box">
                      <MessageRenderer message={message} />
                    </div>
                  ))
                }
                {loading && <LoadingAnimation />}
              </div>
              <div className=" w-full md:w-3/4 lg:w-1/2 z-30 fixed bottom-0 p-5">
                <div className="input-group bg-stone-100">
                  <form onSubmit={handleSubmit} className="input-group">
                    <input
                      type="text"
                      value={inputText}
                      className="input input-primary w-full bg-stone-900"
                      name="chatInput"
                      placeholder="Type your message..."
                      onChange={handleInputChange}
                    />
                    {isTyping ? (
                      <button className="btn btn-square border-0 bg-pink-500">
                        <Send className="w-5 h-5 text-base-500" />
                      </button>
                    ) : (
                      <button className="btn btn-square border-0 bg-pink-500">
                        <Mic className="w-5 h-5 text-base-500" />
                      </button>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div
            className="drawer-side bg-slate-400"
            style={{ scrollBehavior: "smooth", scrollPaddingTop: "5rem" }}
          >
            <label htmlFor="sidebar" className="drawer-overlay  "></label>
            <aside className="p-3 w-72 bg-base-100  text-base-content">
              <div className="z-20  bg-opacity-90 backdrop-blur sticky top-0 items-center gap-2 px-4 py-2 hidden lg:flex ">
                <Link
                  href="https://anchorblock.vc"
                  aria-current="page"
                  aria-label="Homepage"
                  className="flex-0 btn btn-ghost px-2"
                >
                  Anchorblock
                </Link>
              </div>
              <div className="h-4"></div>
              <div className="flex flex-col space-y-2">
                <button className="btn btn-primary w-full" onClick={handleNewChat}>New Chat</button>
                <input
                  placeholder="Search ..."
                  className="input w-full input-bordered"
                />
              </div>
              <div className="h-4"></div>
              <div className="px-1 py-1 overflow-y-auto h-80 bg-base-200 ">
                {/* <ul className="p-2 space-y-2">
                  <li>
                    <button className="btn btn-outline">
                      How to make a div center ...
                    </button>
                  </li>
                  <li>
                    <button className="btn btn-outline">
                      How to make a component in React ...
                    </button>
                  </li>
                </ul> */}
              </div>
              <div className="divider"></div>
              <ul className="menu text-sm  w-56 p-2 rounded-box">
                <li>
                  <a>
                    <Trash className="h-5 w-5" />
                    Clear Conversations
                  </a>
                </li>
                <li>
                  <a>
                    <Key className="h-5 w-5" />
                    OpenAI API KEY
                  </a>
                </li>
                <li>
                  <a>
                    <Settings className="h-5 w-5" />
                    Settings
                  </a>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
