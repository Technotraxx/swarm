import streamlit as st
import os
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

# Store API keys in session state
if 'openai_api_key' not in st.session_state:
    st.session_state.openai_api_key = openai_api_key
if 'firecrawl_api_key' not in st.session_state:
    st.session_state.firecrawl_api_key = firecrawl_api_key

# Initialize clients only if API keys are provided
@st.cache_resource
def init_clients():
    if not st.session_state.openai_api_key or not st.session_state.firecrawl_api_key:
        st.error("Please provide both OpenAI and Firecrawl API keys in the sidebar.")
        return None, None, None
    
    try:
        app = FirecrawlApp(api_key=st.session_state.firecrawl_api_key)
        client = OpenAI(api_key=st.session_state.openai_api_key)
        swarm_client = Swarm()
        return app, client, swarm_client
    except Exception as e:
        st.error(f"Error initializing clients: {str(e)}")
        return None, None, None

app, client, swarm_client = init_clients()

# Define function to scrape website directly using Firecrawl
def scrape_website(url):
    """Scrape a website using Firecrawl and return the raw response."""
    try:
        scrape_status = app.scrape_url(url, params={'formats': ['markdown']})
        return scrape_status
    except Exception as e:
        st.error(f"Error scraping {url}: {str(e)}")
        return None

def generate_completion(role, task, content):
    """Generate a completion using OpenAI."""
    response = client.chat.completions.create(
        model="gpt-4o",
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

# Define agents
scraper_agent = Agent(
    name="Scraper Agent",
    instructions="You are a scraper agent specialized in scraping website content.",
    functions=[scrape_website],
)

summarizer_agent = Agent(
    name="Summarizer Agent",
    instructions="You are a summarizer agent that examines scraped content and provides a concise summary.",
    functions=[summarize_article],
)

idea_generator_agent = Agent(
    name="Idea Generator Agent",
    instructions="You are an idea generator agent that creates innovative content ideas based on article summaries.",
    functions=[generate_article_idea],
)

style_suggester_agent = Agent(
    name="Style Suggester Agent",
    instructions="You are a style suggester agent specialized in providing style and writing suggestions based on content ideas and target audience.",
    functions=[generate_style_suggestions],
)

article_generator_agent = Agent(
    name="Article Generator Agent",
    instructions="You are an article generator agent specialized in creating new articles based on all provided inputs.",
    functions=[generate_new_article],
)

# Streamlit UI
st.title("Editorial Assistant")
st.write("Analyze articles, generate ideas, and create new content with ease.")

# 1. Scrape websites
st.header("1. Scrape Websites")
url1 = st.text_input("Enter the first website URL to scrape")
url2 = st.text_input("Enter the second website URL to scrape")

if st.button("Scrape Websites"):
    if not app:
        st.error("Please provide a valid Firecrawl API key before proceeding.")
    elif url1 or url2:
        scraped_content = {}
        if url1:
            content1 = scrape_website(url1)
            if content1:
                scraped_content["source1"] = content1
        if url2:
            content2 = scrape_website(url2)
            if content2:
                scraped_content["source2"] = content2
        
        if scraped_content:
            st.session_state.scraped_content = scraped_content
            st.success("Websites scraped successfully!")
        else:
            st.error("Failed to scrape any content. Please check the URLs and try again.")
    else:
        st.error("Please enter at least one valid URL.")

# Display scraped content (if available)
if hasattr(st.session_state, 'scraped_content'):
    with st.expander("View Scraped Content", expanded=True):
        tab1, tab2 = st.tabs(["Source 1", "Source 2"])
        
        with tab1:
            if "source1" in st.session_state.scraped_content:
                st.json(st.session_state.scraped_content["source1"])
            else:
                st.write("No content scraped for Source 1")
        
        with tab2:
            if "source2" in st.session_state.scraped_content:
                st.json(st.session_state.scraped_content["source2"])
            else:
                st.write("No content scraped for Source 2")

# 2. Summarize the article
st.header("2. Summarize the Article")
if st.button("Summarize Article"):
    if hasattr(st.session_state, 'scraped_content'):
        combined_content = "\n\n".join(st.session_state.scraped_content.values())  # Combine content as text
        response = swarm_client.run(agent=summarizer_agent, messages=[{"role": "user", "content": combined_content}])
        summary = response.messages[-1]["content"]
        st.session_state.summary = summary
        st.markdown(summary)
    else:
        st.error("Please scrape websites first.")

# 3. Generate article idea
st.header("3. Generate Article Idea")
if st.button("Generate Idea"):
    if hasattr(st.session_state, 'summary'):
        response = swarm_client.run(agent=idea_generator_agent, messages=[{"role": "user", "content": st.session_state.summary}])
        idea = response.messages[-1]["content"]
        st.session_state.idea = idea
        st.write(idea)
    else:
        st.error("Please summarize the article first.")

# 4. Enter custom instructions
st.header("4. Custom Instructions")
custom_instructions = st.text_area("Enter custom instructions for generating the new article")

# 5. Target audience input
st.header("5. Target Audience")
target_audience = st.text_input("Enter the target audience for the new article")

# 6. Goals for the new article
st.header("6. Article Goals")
goals = st.text_area("Enter the goals for the new article")

# 7. Generate style and writing suggestions
st.header("7. Generate Style Suggestions")
if st.button("Generate Style Suggestions"):
    if all(hasattr(st.session_state, attr) for attr in ['scraped_content', 'idea']):
        response = swarm_client.run(
            agent=style_suggester_agent, 
            messages=[{
                "role": "user", 
                "content": f"Original Article: {st.session_state.scraped_content}\nNew Idea: {st.session_state.idea}\nTarget Audience: {target_audience}\nGoals: {goals}"
            }]
        )
        style_suggestions = response.messages[-1]["content"]
        st.session_state.style_suggestions = style_suggestions
        st.write(style_suggestions)
    else:
        st.error("Please complete all previous steps first.")

# 8. Generate the new article
st.header("8. Generate New Article")
if st.button("Generate New Article"):
    if all(hasattr(st.session_state, attr) for attr in ['scraped_content', 'idea', 'style_suggestions']):
        response = swarm_client.run(
            agent=article_generator_agent,
            messages=[{
                "role": "user",
                "content": f"Original Article: {st.session_state.scraped_content}\nNew Idea: {st.session_state.idea}\nTarget Audience: {target_audience}\nGoals: {goals}\nStyle Suggestions: {st.session_state.style_suggestions}\nCustom Instructions: {custom_instructions}"
            }]
        )
        new_article = response.messages[-1]["content"]
        st.markdown(new_article)
    else:
        st.error("Please complete all previous steps first.")
