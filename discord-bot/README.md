# PeiPlay Discord Bot

Discord Bot for PeiPlay voice channel management and user pairing.

## Features

- 🎤 Voice channel creation and management
- 👥 User pairing and matching
- ⏰ Automatic channel cleanup
- 📊 Statistics tracking
- 🚫 User blocking system
- ⭐ Rating and feedback system

## Setup

### Prerequisites

- Python 3.8+
- Discord Bot Token
- PostgreSQL Database

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env`:
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_guild_id
POSTGRES_CONN=your_database_url
ADMIN_CHANNEL_ID=your_admin_channel_id
CHECK_INTERVAL=30
```

3. Run the bot:
```bash
python bot.py
```

## Commands

- `/createvc` - Create voice channel with specified members
- `/viewblocklist` - View your blocked users
- `/unblock` - Unblock a user
- `/report` - Report inappropriate behavior
- `/mystats` - View your pairing statistics
- `/stats` - View other user's statistics (Admin only)

## Deployment

### Railway
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

### Heroku
1. Create Heroku app
2. Set buildpacks for Python
3. Set environment variables
4. Deploy

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Discord Bot Token | Yes |
| `DISCORD_GUILD_ID` | Discord Server ID | Yes |
| `POSTGRES_CONN` | Database Connection String | Yes |
| `ADMIN_CHANNEL_ID` | Admin Channel ID | Yes |
| `CHECK_INTERVAL` | Channel Check Interval (seconds) | No |

## Database Schema

The bot uses the following database tables:
- `User` - User information
- `Customer` - Customer profiles
- `Partner` - Partner profiles
- `Schedule` - Scheduling information
- `Booking` - Booking records
- `pairing_records` - Voice channel pairing records
- `block_records` - User blocking records 