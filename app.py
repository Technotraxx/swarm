import streamlit as st
import os
import json
from firecrawl import FirecrawlApp
from swarm import Swarm, Agent
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

# Initialize FirecrawlApp, OpenAI client, and Swarm client
app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
swarm_client = Swarm()

# Define agents for various tasks
interactive_agent = Agent(
    name="Interactive Agent",
    instructions="You are a helpful agent that assists users with refining their marketing brief iteratively. Provide feedback and suggestions based on user input.",
)

helpful_agent = Agent(
    name="Helpful Agent",
    instructions="You are a helpful agent.",
)

def get_weather(location, time="now"):
    """Get the current weather in a given location. Location MUST be a city."""
    return json.dumps({"location": location, "temperature": "65", "time": time})

def send_email(recipient, subject, body):
    print("Sending email...")
    print(f"To: {recipient}")
    print(f"Subject: {subject}")
    print(f"Body: {body}")
    return "Sent!"

weather_agent = Agent(
    name="Weather Agent",
    instructions="You are a helpful agent that provides weather information and can send emails.",
    functions=[get_weather, send_email],
)

# Initialize session states for the new tab
if "weather_messages" not in st.session_state:
    st.session_state.weather_messages = []
if "weather_agent" not in st.session_state:
    st.session_state.weather_agent = weather_agent

# Define functions for the marketing assistant tab
def scrape_website(url):
    """Scrape a website using Firecrawl."""
    scrape_status = app.scrape_url(url, params={'formats': ['markdown']})
    return scrape_status

def generate_completion(role, task, content):
    """Generate a completion using OpenAI."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"You are a {role}. {task}"},
            {"role": "user", "content": content}
        ]
    )
    return response.choices[0].message.content

def analyze_website_content(content):
    """Analyze the scraped website content using OpenAI."""
    analysis = generate_completion(
        "marketing analyst",
        "Analyze the following website content and provide key insights for marketing strategy.",
        content
    )
    return {"analysis": analysis}

def generate_copy(brief):
    """Generate marketing copy based on a brief using OpenAI."""
    copy = generate_completion(
        "copywriter",
        "Create compelling marketing copy based on the following brief.",
        brief
    )
    return {"copy": copy}

def create_campaign_idea(target_audience, goals):
    """Create a campaign idea based on target audience and goals using OpenAI."""
    campaign_idea = generate_completion(
        "marketing strategist",
        "Create an innovative campaign idea based on the target audience and goals provided.",
        f"Target Audience: {target_audience}\nGoals: {goals}"
    )
    return {"campaign_idea": campaign_idea}

# Create tabs for different functionalities
tab1, tab2, tab3, tab4 = st.tabs(["Marketing Assistant", "Interactive Agent", "Helpful Agent Loop", "Weather Agent"])

# Tab 1: Marketing Assistant
with tab1:
    st.title("Firecrawl and OpenAI Marketing Assistant")
    st.write("Analyze websites and generate marketing strategies with ease.")

    # Input for the website URL
    url = st.text_input("Enter the website URL to scrape")

    # Button to scrape the website
    if st.button("Scrape Website"):
        if url:
            scrape_status = scrape_website(url)
            st.json(scrape_status)
        else:
            st.error("Please enter a valid URL.")

    # Input for analyzing website content
    website_content = st.text_area("Enter scraped website content for analysis")

    # Button to analyze content
    if st.button("Analyze Website Content"):
        if website_content:
            analysis = analyze_website_content(website_content)
            st.json(analysis)
        else:
            st.error("Please provide website content for analysis.")

    # Input for generating marketing copy
    brief = st.text_area("Enter a brief for generating marketing copy")

    # Button to generate copy
    if st.button("Generate Marketing Copy"):
        if brief:
            copy = generate_copy(brief)
            st.json(copy)
        else:
            st.error("Please provide a brief.")

    # Inputs for creating a campaign idea
    target_audience = st.text_input("Target Audience")
    goals = st.text_area("Goals")

    # Button to create a campaign idea
    if st.button("Create Campaign Idea"):
        if target_audience and goals:
            campaign_idea = create_campaign_idea(target_audience, goals)
            st.json(campaign_idea)
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
        st.session_state.messages.append({"role": "user", "content": user_input})
        response = swarm_client.run(agent=st.session_state.agent, messages=st.session_state.messages)
        st.session_state.messages = response.messages
        st.session_state.latest_response = response.messages[-1]["content"]

    # Display the conversation history
    st.write("### Conversation History:")
    for message in st.session_state.messages[:-1]:
        if message["content"]:
            st.write(f"**{message['role'].capitalize()}**: {message['content']}")

    # Display the latest content suggestion
    if st.session_state.latest_response:
        st.write("### Content Suggestions:")
        st.write(st.session_state.latest_response)

        # Provide interactive buttons for refining the content
        st.write("### Would you like to refine further?")
        if st.button("Clarify Benefits"):
            st.session_state.messages.append({"role": "user", "content": "Can you clarify the benefits in more detail?"})
        if st.button("Add Examples"):
            st.session_state.messages.append({"role": "user", "content": "Can you add examples to make it more engaging?"})
        if st.button("Simplify Content"):
            st.session_state.messages.append({"role": "user", "content": "Can you simplify the content to make it more accessible?"})
        if st.button("Change Focus"):
            st.session_state.messages.append({"role": "user", "content": "Can we change the focus to highlight a different aspect?"})

        # Automatically process the agent's response after a button press
        if st.session_state.messages:
            response = swarm_client.run(agent=st.session_state.agent, messages=st.session_state.messages)
            st.session_state.messages = response.messages
            st.session_state.latest_response = response.messages[-1]["content"]

# Tab 3: Helpful Agent Loop
with tab3:
    st.title("Helpful Agent Loop")
    st.write("Engage in a continuous conversation with the helpful agent.")

    # Input text area for user input
    loop_user_input = st.text_input("Enter your message:")

    # Button to submit input and interact with the helpful agent
    if st.button("Send", key="loop_submit") and loop_user_input:
        st.session_state.helpful_messages.append({"role": "user", "content": loop_user_input})
        response = swarm_client.run(agent=st.session_state.helpful_agent, messages=st.session_state.helpful_messages)
        st.session_state.helpful_messages = response.messages
        st.session_state.helpful_agent = response.agent

    # Display the conversation history
    st.write("### Conversation History:")
    for message in st.session_state.helpful_messages:
        if message["content"]:
            st.write(f"**{message['role'].capitalize()}**: {message['content']}")

    # Instructions for users
    st.info("Keep the conversation going by entering a message and pressing 'Send'. The agent will respond to each message in turn.")

# Tab 4: Weather Agent
with tab4:
    st.title("Weather Agent")
    st.write("Get weather information and send emails using the Weather Agent.")

    # Input for getting weather information
    location = st.text_input("Enter a city for weather information:")
    time = st.text_input("Enter a time (e.g., 'now', 'tomorrow'):", value="now")

    # Button to get weather information
    if st.button("Get Weather"):
        if location:
            weather_response = get_weather(location, time)
            st.json(json.loads(weather_response))
        else:
            st.error("Please enter a city.")

    # Input for sending an email
    recipient = st.text_input("Enter email recipient:")
    subject = st.text_input("Enter email subject:")
    body = st.text_area("Enter email body:")

    # Button to send an email
    if st.button("Send Email"):
        if recipient and subject and body:
            email_status = send_email(recipient, subject, body)
            st.success(email_status)
        else:
            st.error("Please fill in all email fields.")
