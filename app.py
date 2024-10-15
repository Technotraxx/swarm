# Streamlit App for Firecrawl and OpenAI Integration
import streamlit as st
import os
from firecrawl import FirecrawlApp
from swarm import Agent
from swarm.repl import run_demo_loop
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

# Initialize FirecrawlApp and OpenAI
app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def scrape_website(url):
    """Scrape a website using Firecrawl."""
    scrape_status = app.scrape_url(
        url,
        params={'formats': ['markdown']}
    )
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

# Streamlit user interface
st.title("Firecrawl and OpenAI Marketing Assistant")

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

# Instructions for the user
st.info("Make sure to enter your API keys in the sidebar and fill in the necessary fields before clicking the buttons.")

# Run the app using: streamlit run app.py
