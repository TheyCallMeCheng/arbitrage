import { DatabaseService } from "./database"

// Function to get all symbols from the database
export function getAllSymbolsFromDatabase(): string[] {
    const db = new DatabaseService()
    try {
        const symbols = db.getAllSymbols()
        return symbols
    } finally {
        db.close()
    }
}

// Function to get all symbols with their data
export function getAllSymbolsWithData() {
    const db = new DatabaseService()
    try {
        const data = db.queryWithAllSymbols()
        return data
    } finally {
        db.close()
    }
}

// Usage example
if (require.main === module) {
    console.log("Getting all symbols from database...")
    const symbols = getAllSymbolsFromDatabase()
    console.log(`Found ${symbols.length} symbols:`, symbols)

    console.log("\nGetting all symbols with data...")
    const symbolsWithData = getAllSymbolsWithData()
    console.log(`Found ${symbolsWithData.length} records`)
    console.log("Sample:", symbolsWithData.slice(0, 3))
}
