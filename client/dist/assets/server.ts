const GOOG_CLIENT_ID = "";
const ENDPOINT = "";

const metaTag = document.querySelector('meta[name="google-signin-client_id"]') as HTMLMetaElement;
if (metaTag !== undefined) metaTag.content = GOOG_CLIENT_ID;

const lambdaServer = {
    serverURLs: {
        dev: ENDPOINT,
        prod: ENDPOINT,
        id: GOOG_CLIENT_ID
    },
    get server() 
    {
        if (window.location.hostname.indexOf("dev") > 0)
            return this.serverURLs["dev"]
        else if (window.location.hostname.indexOf("prod") > 0)
            return this.serverURLs["prod"]
        else
            return this.serverURLs["prod"]          //default to production environment
    },
    get clientID()
    {
        return this.serverURLs["id"] ;
    }
};

