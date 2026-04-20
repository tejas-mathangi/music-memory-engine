# Music Memory Engine Logic & Scaling

## Architecture Explanation

This system follows **Clean Architecture** principles, prioritizing efficient data structures for real-time recommendations.

### 1. Data Structures & Their Roles
- **HashMap** (`userId -> Map<songId, playCount>`): Provides O(1) access to user play history. This is our primary interaction storage.
- **Graph**: Songs are nodes; similarity is represented by weighted edges. This allows us to "pivot" from a song the user likes to similar candidate nodes.
- **Priority Queue**: Used in the Recommendation Service to sort candidates by their calculated scores in O(log N) time.
- **Sliding Window**: A fixed-size queue (LinkedList) that tracks the last $N$ actions. This captures **temporal shifts** in mood or taste (e.g., "currently in a workout mood").

### 2. Recommendation Scoring Algorithm
The score for a song $S$ is calculated as:
$$Score(S) = (PlayCount(S) \times 2) - (IsSkipped(S) \times 10) + \sum_{R \in Window} Similarity(S, R)$$

- **Weighting**: Replays signal high intent.
- **Penalization**: Skips signal negative intent (high penalty).
- **Recency Boost**: We use the sliding window to look up neighbors in the Graph.

---

## Scaling to Production

### 1. Scalability Strategies
- **Caching**: Since graph traversal and scoring can be expensive, pre-calculate recommendations for top users. Use **Redis** to store the `SlidingWindow` and `ScoredCandidates`.
- **Database**:
  - Store the Knowledge Graph in a dedicated graph database like **Neo4j**.
  - Use a NoSQL database (like **Cassandra** or **DynamoDB**) for high-write user action logs.
- **Microservices**: Separate the `IngestionService` (handling plays/skips) from the `InferenceService` (generating recommendations) to scale them independently.

### 2. Embeddings & AI Improvements
- **Vector Embeddings**: Instead of manual similarity scores (genre/tempo), use **Large Language Models (LLMs)** or **Audio CNNs** to generate 128-dimensional vectors for every song.
- **Vector Database**: Store these embeddings in **Pinecone** or **Milvus**. Recommendation then becomes a **K-Nearest Neighbors (KNN)** search in vector space.
- **Reinforcement Learning (RL)**: Use RL (specifically Multi-Armed Bandits) to balance **Exploitation** (songs we know you like) vs **Exploration** (new songs to discover your evolving taste).

## Sample Dataset
The engine comes pre-seeded with 10 songs across Pop, Electronic, Rock, and Jazz genres with varying mood metadata.
