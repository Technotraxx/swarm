import streamlit as st
from swarm import Swarm, Agent
import os
from firecrawl import FirecrawlApp
import dotenv
from openai import OpenAI

# Load environment variables
dotenv.load_dotenv()

# Streamlit sidebar for API key inputs
st.sidebar.title("API Key Configuration")
openai_api_key = st.sidebar.text_input("OpenAI API Key", type="password")
firecrawl_api_key = st.sidebar.text_input("Firecrawl API Key", type="password")

# Store API keys in environment variables
os.environ["OPENAI_API_KEY"] = openai_api_key
os.environ["FIRECRAWL_API_KEY"] = firecrawl_api_key

# Initialize Swarm client and agent
swarm_client = Swarm()
interactive_agent = Agent(
    name="Interactive Agent",
    instructions="You are a helpful agent that assists users with refining their marketing brief iteratively. Provide feedback and suggestions based on user input.",
)

# Initialize FirecrawlApp and OpenAI client for the marketing assistant tab
firecrawl_app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize or retrieve session state for the interactive agent
if "messages" not in st.session_state:
    st.session_state.messages = []
if "agent" not in st.session_state:
    st.session_state.agent = interactive_agent

# Define tabs for different functionalities
tab1, tab2 = st.tabs(["Marketing Assistant", "Interactive Agent"])

# Tab 1: Marketing Assistant
with tab1:
    st.title("Firecrawl and OpenAI Marketing Assistant")
    st.write("Analyze websites and generate marketing strategies with ease.")

    # Input for the website URL
    url = st.text_input("Enter the website URL to scrape")

    # Button to scrape the website
    if st.button("Scrape Website"):
        if url:
            scrape_status = firecrawl_app.scrape_url(url, params={'formats': ['markdown']})
            st.json(scrape_status)
        else:
            st.error("Please enter a valid URL.")

    # Input for analyzing website content
    website_content = st.text_area("Enter scraped website content for analysis")

    # Button to analyze content
    if st.button("Analyze Website Content"):
        if website_content:
            analysis = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a marketing analyst. Analyze the following website content and provide key insights for marketing strategy."},
                    {"role": "user", "content": website_content}
                ]
            )
            st.json({"analysis": analysis.choices[0].message.content})
        else:
            st.error("Please provide website content for analysis.")

    # Input for generating marketing copy
    brief = st.text_area("Enter a brief for generating marketing copy")

    # Button to generate copy
    if st.button("Generate Marketing Copy"):
        if brief:
            copy = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a copywriter. Create compelling marketing copy based on the following brief."},
                    {"role": "user", "content": brief}
                ]
            )
            st.json({"copy": copy.choices[0].message.content})
        else:
            st.error("Please provide a brief.")

    # Inputs for creating a campaign idea
    target_audience = st.text_input("Target Audience")
    goals = st.text_area("Goals")

    # Button to create a campaign idea
    if st.button("Create Campaign Idea"):
        if target_audience and goals:
            campaign_idea = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a marketing strategist. Create an innovative campaign idea based on the target audience and goals provided."},
                    {"role": "user", "content": f"Target Audience: {target_audience}\nGoals: {goals}"}
                ]
            )
            st.json({"campaign_idea": campaign_idea.choices[0].message.content})
        else:
            st.error("Please provide both target audience and goals.")

# Tab 2: Interactive Agent
with tab2:
    st.title("Interactive Marketing Assistant")
    st.write("Refine your marketing brief iteratively with real-time feedback.")

    # Input text area for user to refine their brief
    user_input = st.text_input("Enter your brief or marketing idea:")

    # Button to submit input and get a response from the agent
    if st.button("Submit", key="interactive_submit") and user_input:
        # Append the user input to messages
        st.session_state.messages.append({"role": "user", "content": user_input})

        # Run the agent with the current messages
        response = swarm_client.run(agent=st.session_state.agent, messages=st.session_state.messages)
        st.session_state.messages = response.messages
        st.session_state.agent = response.agent

    # Display the conversation history
    st.write("### Conversation History:")
    for message in st.session_state.messages:
        if message["content"]:
            st.write(f"**{message['role'].capitalize()}**: {message['content']}")

    # Provide interactive suggestions
    if st.session_state.messages:
        last_agent_message = [msg for msg in st.session_state.messages if msg["role"] == "assistant"][-1]["content"]
        st.write("### Content Suggestions:")
        st.write(last_agent_message)

        # Predefined options for iterating on suggestions
        st.write("### Would you like to refine further?")
        if st.button("Clarify Benefits"):
            st.session_state.messages.append({"role": "user", "content": "Can you clarify the benefits in more detail?"})
        if st.button("Add Examples"):
            st.session_state.messages.append({"role": "user", "content": "Can you add examples to make it more engaging?"})
        if st.button("Simplify Content"):
            st.session_state.messages.append({"role": "user", "content": "Can you simplify the content to make it more accessible?"})
        if st.button("Change Focus"):
            st.session_state.messages.append({"role": "user", "content": "Can we change the focus to highlight a different aspect?"})
        
        # Automatically run the agent after user chooses a refinement option
        if any(st.session_state.messages):
            response = swarm_client.run(agent=st.session_state.agent, messages=st.session_state.messages)
            st.session_state.messages = response.messages
            st.session_state.agent = response.agent

    # Instructions for users
    st.info("Use the predefined buttons to refine your brief iteratively. Adjust your input based on the agent’s feedback until you are satisfied.")
