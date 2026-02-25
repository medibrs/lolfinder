

const user1 = {
    name: "Yusuf",
    email: "[EMAIL_ADDRESS]",
    image: "https://avatars.githubusercontent.com/u/10239985?v=4",
    imageW: "w-10",
    imageH: "h-10"
}



const user2 = {
    name : "achraf",
    email : "[EMAIL_ADDRESS]",
    image : "https://avatars.githubusercontent.com/u/10239985?v=4",
    imageW : "w-10",
    imageH : "h-10"
}


function User({ user} : { user:any}) {
    return (
        <div className="flex flex-col gap-2">
            <p>{user.name}</p>
            <p>{user.email}</p>
            <img src={user.image} alt={user.name} className={user.imageW + " " + user.imageH} />
        </div>
    )
}


export default function Test() {

    return (
        <>
            <div className="grid grid-cols-4 gap-4 pt-16">
                <User user={user1} />
                <User user={user2} />   
            </div>
        </>
    )
}
