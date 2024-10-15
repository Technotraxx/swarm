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
@st.cache_resource
def init_clients():
    app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    swarm_client = Swarm()
    return app, client, swarm_client

app, client, swarm_client = init_clients()

# Define functions
def scrape_website(url):
    """Scrape a website using Firecrawl."""
    scrape_status = app.scrape_url(url, params={'formats': ['markdown']})
    return scrape_status

def generate_completion(role, task, content):
    """Generate a completion using OpenAI."""
    response = client.chat.completions.create(
        model="gpt-4-1106-preview",
        messages=[
            {"role": "user", "content": f"You are a {role}. {task}\n\nContent: {content}"}
        ]
    )
    return response.choices[0].message.content

def summarize_article(content):
    """Summarize the scraped article content using OpenAI."""
    summary = generate_completion(
        "editorial analyst",
        "Summarize the following article content. Extract the most important quotes, important facts, and provide a one-paragraph summary.",
        content
    )
    return summary

def generate_article_idea(summary):
    """Generate an idea for what to do with the article using OpenAI."""
    idea = generate_completion(
        "content strategist",
        "Based on the following article summary, generate an idea for a new article or content piece.",
        summary
    )
    return idea

def generate_style_suggestions(original_article, idea, target_audience, goals):
    """Generate style and writing suggestions based on inputs."""
    suggestions = generate_completion(
        "editorial stylist",
        "Provide style and writing suggestions based on the original article, new idea, target audience, and goals.",
        f"Original Article: {original_article}\nNew Idea: {idea}\nTarget Audience: {target_audience}\nGoals: {goals}"
    )
    return suggestions

def generate_new_article(original_article, idea, target_audience, goals, style_suggestions, custom_instructions):
    """Generate a new article based on all inputs."""
    new_article = generate_completion(
        "content writer",
        f"Create a new article based on the following inputs. {custom_instructions}",
        f"Original Article: {original_article}\nNew Idea: {idea}\nTarget Audience: {target_audience}\nGoals: {goals}\nStyle Suggestions: {style_suggestions}"
    )
    return new_article

# Define handoff functions
def handoff_to_scraper():
    return scraper_agent

def handoff_to_summarizer():
    return summarizer_agent

def handoff_to_idea_generator():
    return idea_generator_agent

def handoff_to_style_suggester():
    return style_suggester_agent

def handoff_to_article_generator():
    return article_generator_agent

# Define agents
user_interface_agent = Agent(
    name="User Interface Agent",
    instructions="You are a user interface agent that handles all interactions with the user. You need to always start by asking for URLs to scrape. Ask clarification questions if needed. Be concise.",
    functions=[scrape_website],
)

scraper_agent = Agent(
    name="Scraper Agent",
    instructions="You are a scraper agent specialized in scraping website content.",
    functions=[scrape_website, handoff_to_summarizer],
)

summarizer_agent = Agent(
    name="Summarizer Agent",
    instructions="You are a summarizer agent that examines scraped content and provides a concise summary.",
    functions=[summarize_article, handoff_to_idea_generator],
)

idea_generator_agent = Agent(
    name="Idea Generator Agent",
    instructions="You are an idea generator agent that creates innovative content ideas based on article summaries. Be concise.",
    functions=[generate_article_idea, handoff_to_style_suggester],
)

style_suggester_agent = Agent(
    name="Style Suggester Agent",
    instructions="You are a style suggester agent specialized in providing style and writing suggestions based on content ideas and target audience. Be concise.",
    functions=[generate_style_suggestions, handoff_to_article_generator],
)

article_generator_agent = Agent(
    name="Article Generator Agent",
    instructions="You are an article generator agent specialized in creating new articles based on all provided inputs. Be concise.",
    functions=[generate_new_article],
)

# Streamlit UI
st.title("Editorial Assistant")
st.write("Analyze articles, generate ideas, and create new content with ease.")

# Initialize session state
if 'current_agent' not in st.session_state:
    st.session_state.current_agent = user_interface_agent
if 'conversation' not in st.session_state:
    st.session_state.conversation = []

# Display conversation history
for message in st.session_state.conversation:
    st.write(f"{message['role']}: {message['content']}")

# User input
user_input = st.text_input("Your input:")

if st.button("Submit"):
    if not openai_api_key or not firecrawl_api_key:
        st.error("Please enter both API keys in the sidebar.")
    else:
        try:
            # Add user input to conversation
            st.session_state.conversation.append({"role": "User", "content": user_input})
            
            # Process user input with current agent
            response = swarm_client.run(agent=st.session_state.current_agent, messages=[{"role": "user", "content": user_input}])
            
            # Add agent response to conversation
            st.session_state.conversation.append({"role": st.session_state.current_agent.name, "content": response.content})
            
            # Check if agent handed off to another agent
            if response.next_agent:
                st.session_state.current_agent = response.next_agent
                st.write(f"Handing off to {response.next_agent.name}")
            
            # Rerun the app to update the display
            st.experimental_rerun()
        except Exception as e:
            st.error(f"An error occurred: {str(e)}")

# Display current agent in sidebar
st.sidebar.write(f"Current Agent: {st.session_state.current_agent.name}")
